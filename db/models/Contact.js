module.exports = (sequelize, DataTypes) => {
  const Contact = sequelize.define(
    "Contact",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      phoneNumber: { type: DataTypes.STRING, allowNull: true },
      email: { type: DataTypes.STRING, allowNull: true },
      linkedId: { type: DataTypes.INTEGER },
      linkPrecedence: { type: DataTypes.STRING, allowNull: false },
      createdAt: { type: DataTypes.DATE },
      updatedAt: { type: DataTypes.DATE },
      deletedAt: { type: DataTypes.DATE },
    },
    {
      freezeTableName: true,
    }
  );

  return Contact;
};
