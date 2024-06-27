const { Op } = require("sequelize");
const models = require("../db/models");

/**
 * checkIfEmailAndPhoneExists
 * Checks if the phoneNumber and email already present in Contact table
 * @param {existingContacts, email, phoneNumber}
 * @returns
 */
const checkIfEmailAndPhoneExists = ({
  existingContacts,
  email,
  phoneNumber,
}) => {
  let emailExist = false;
  let phoneExist = false;

  for (const contact of existingContacts) {
    if (!emailExist && contact.email == email) {
      emailExist = true;
    }
    if (!phoneExist && contact.phoneNumber == phoneNumber) {
      phoneExist = true;
    }

    // if both exists return immediately
    if (emailExist && phoneExist) return true;
  }
  return false;
};

/**
 * getExistingContacts
 * get existing contacts for given email & phone number
 * @param {email, phoneNumber}
 * @returns { existingContacts, emailAndPhoneExist }
 */
const getExistingContacts = async ({ email, phoneNumber }) => {
  let emailContact = [];
  let phoneContact = [];
  if (email) {
    emailContact = await models.Contact.findAll({
      where: {
        email,
      },
      raw: true,
    });
  }
  const filter = { phoneNumber };
  // filter out already found existing contacts
  if (emailContact.length > 0) {
    const ids = emailContact.map((entry) => entry.id);
    filter.id = { [Op.notIn]: ids };
  }

  if (phoneNumber) {
    phoneContact = await models.Contact.findAll({
      where: filter,
      raw: true,
    });
  }

  const existingContacts = [...emailContact, ...phoneContact];
  const emailAndPhoneExist = checkIfEmailAndPhoneExists({
    existingContacts,
    email,
    phoneNumber,
  });
  return { existingContacts, emailAndPhoneExist };
};

/**
 * createNewContact
 * creates new entry in Contact table
 * @param { email, phoneNumber, linkedId, linkPrecedence,}
 * @returns response
 */
const createNewContact = async ({
  email,
  phoneNumber,
  linkedId = null,
  linkPrecedence,
}) => {
  const response = await models.Contact.create({
    email,
    phoneNumber,
    linkedId,
    linkPrecedence,
  });
  return response;
};

/**
 * getPrimaryEntries
 * @param {*} existingContacts
 * @returns {primaryEntries}
 */
const getPrimaryEntries = async (existingContacts) => {
  // primary contact ids from existing contact
  const existingPrimaryIds = existingContacts
    .filter((data) => data.linkPrecedence === "primary")
    .map((entry) => entry.id);

  // primary contact ids form linked ids of existing secondary contacts
  const linkedPrimaryIds = existingContacts.map((contact) => {
    if (contact.linkedId) {
      return contact.linkedId;
    }
  });

  // get unique values
  const primaryContactIds = Array.from(
    new Set([...existingPrimaryIds, ...linkedPrimaryIds])
  );

  const primaryEntries = await models.Contact.findAll({
    where: {
      id: {
        [Op.in]: primaryContactIds,
      },
    },
    raw: true,
  });

  return { primaryEntries };
};

/**
 * changeLinkPrecedence
 * update primary contact to secondary and returns required data
 * @param { primaryEntries }
 * @returns
 */
const changeLinkPrecedence = async ({ primaryEntries }) => {
  // Sort by id to find first entry, since id is PK & auto incrementing
  let contacts = primaryEntries.sort((a, b) => a.id - b.id);

  // link all the secondary of the second primary contact to the first primary contact
  await models.Contact.update(
    { linkPrecedence: "secondary", linkedId: contacts[0].id },
    {
      where: {
        [Op.or]: [{ id: contacts[1].id }, { linkedId: contacts[1].id }],
      },
    }
  );

  const secondaryContacts = await models.Contact.findAll({
    attributes: ["phoneNumber", "email"],
    where: { linkedId: contacts[0].id },
    raw: true,
  });

  const secondaryPhoneNumber = [];
  const secondaryEmail = [];
  secondaryContacts.map((contact) => {
    secondaryPhoneNumber.push(contact.phoneNumber);
    secondaryEmail.push(contact.email);
  });

  return {
    id: contacts[0].id,
    email: contacts[0].email,
    phoneNumber: contacts[0].phoneNumber,
    secondaryId: contacts[1].id,
    secondaryPhoneNumber,
    secondaryEmail,
  };
};

/**
 * getSecondaryContactData
 * gets all secondary contacts details
 * @param {*} primaryContactId
 * @returns result
 */
const getSecondaryContactData = async (primaryContactId) => {
  const secondaryData = await models.Contact.findAll({
    attributes: ["id", "email", "phoneNumber"],
    where: { linkedId: primaryContactId },
    raw: true,
  });

  const result = {
    emails: [],
    ids: [],
    phoneNumbers: [],
  };
  secondaryData.map((data) => {
    result.emails.push(data.email);
    result.ids.push(data.id);
    result.phoneNumbers.push(data.phoneNumber);
  });

  return result;
};

/**
 * identifyContact
 * Entry point for the helper function
 * @param req.body, MyError
 * @returns contact details
 */
const identifyContact = async ({ email, phoneNumber }, MyError) => {
  // if no email and phoneNumber then throw error
  if (!email && !phoneNumber) {
    throw new MyError("Please provide email or phone number!");
  }

  const { existingContacts, emailAndPhoneExist } = await getExistingContacts({
    email,
    phoneNumber,
  });
  // New phone number and email
  if (existingContacts.length === 0) {
    const response = await createNewContact({
      email,
      phoneNumber,
      linkPrecedence: "primary",
    });

    return {
      contact: {
        primaryContatctId: response.id,
        emails: [response.email],
        phoneNumbers: [response.phoneNumber],
        secondaryContactIds: [],
      },
    };
  }

  const { primaryEntries } = await getPrimaryEntries(existingContacts);
  const primaryContactIds = primaryEntries.map((entry) => entry.id);

  const { ids, emails, phoneNumbers } = await getSecondaryContactData(
    primaryContactIds
  );

  // Assuming there is two primary entries, one with email & one with phone number
  if (emailAndPhoneExist && primaryEntries && primaryEntries.length > 1) {
    const {
      id,
      email,
      phoneNumber,
      secondaryId,
      secondaryEmail,
      secondaryPhoneNumber,
    } = await changeLinkPrecedence({ primaryEntries });

    return {
      contact: {
        primaryContatctId: id,
        emails: Array.from(new Set([email, ...secondaryEmail])),
        phoneNumbers: Array.from(
          new Set([phoneNumber, ...secondaryPhoneNumber])
        ),
        secondaryContactIds: Array.from(new Set([secondaryId, ...ids])),
      },
    };
  }

  // Edge case - email & phone number exists and no need to change precendence (only one primary contact)
  // if no email or phoneNumber present in req and existing contacts found, then return existing contact info
  if (emailAndPhoneExist || !email || !phoneNumber) {
    return {
      contact: {
        primaryContatctId: primaryEntries[0].id,
        emails: Array.from(new Set([primaryEntries[0].email, ...emails])),
        phoneNumbers: Array.from(
          new Set([primaryEntries[0].phoneNumber, ...phoneNumbers])
        ),
        secondaryContactIds: ids,
      },
    };
  }

  // New information to be added (either new email or new phone number)
  const response = await createNewContact({
    email,
    phoneNumber,
    linkedId: primaryEntries[0].id,
    linkPrecedence: "secondary",
  });

  return {
    contact: {
      primaryContatctId: primaryEntries[0].id,
      emails: Array.from(
        new Set([primaryEntries[0].email, response.email, ...emails])
      ),
      phoneNumbers: Array.from(
        new Set([
          primaryEntries[0].phoneNumber,
          response.phoneNumber,
          ...phoneNumbers,
        ])
      ),
      secondaryContactIds: [...ids, response.id],
    },
  };
};

module.exports = { identifyContact };
