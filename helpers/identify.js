const models = require("../db/models");

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
  if (phoneNumber) {
    phoneContact = await models.Contact.findAll({
      where: {
        phoneNumber,
      },
      raw: true,
    });
  }
  const existingContacts = [...emailContact, ...phoneContact];
  const emailAndPhoneExist = emailContact.length > 0 && phoneContact.length > 0;
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
const getPrimaryEntries = (existingContacts) => {
  const primaryEntries = existingContacts.filter(
    (data) => data.linkPrecedence === "primary"
  );
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

  // Assuming No secondary contact for the below contact
  await models.Contact.update(
    { linkPrecedence: "secondary", linkedId: contacts[0].id },
    { where: { id: contacts[1].id } }
  );

  return {
    id: contacts[0].id,
    email: contacts[0].email,
    phoneNumber: contacts[0].phoneNumber,
    secondaryId: contacts[1].id,
    secondaryPhoneNumber: contacts[1].phoneNumber,
    secondaryEmail: contacts[1].email,
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

  const { primaryEntries } = getPrimaryEntries(existingContacts);
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
        emails: Array.from(new Set([email, secondaryEmail, ...emails])),
        phoneNumbers: Array.from(
          new Set([phoneNumber, secondaryPhoneNumber, ...phoneNumbers])
        ),
        secondaryContactIds: Array.from(new Set([secondaryId, ...ids])),
      },
    };
  }

  // Edge case - email & phone number exists and no need to change precendence (only one primary contact)
  if (emailAndPhoneExist) {
    throw new MyError("Email and phone number already exist!");
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
