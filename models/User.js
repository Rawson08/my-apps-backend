const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const User = sequelize.define('User', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    },
    firstname: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    lastname: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
            isEmail: true,
        },
    },
    username: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    isVerified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    verificationCode: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    verificationExpires: {
        type: DataTypes.DATE,
        allowNull: true,
    },
});

module.exports = User;


// const userSchema = new mongoose.Schema({
//     firstname: { type: String, required: true },
//     lastname: { type: String, required: true },
//     email: { type: String, unique: true, required: true },
//     username: { type: String, unique: true, required: true },
//     password: { type: String, required: true },
//     isVerified: { type: Boolean, default: false },
//     verificationCode: { type: String },
//     verificationExpires: { type: Date },
// });

// module.exports = mongoose.model('User', userSchema);
