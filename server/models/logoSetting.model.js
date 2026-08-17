module.exports = (sequelize, Sequelize) => {
  const ModelName = sequelize.define("modelName", {
    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true
    }
    // Add your fields here
  }, {
    timestamps: true
  });

  return ModelName;
};