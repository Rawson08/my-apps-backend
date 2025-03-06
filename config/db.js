const { Sequelize } = require('sequelize');

// Connect to PostgreSQL using the DATABASE_URL from Render
const sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false, // Required for some cloud providers
      },
    },
    logging: false, // Disable logging (optional)
  });
  
  (async () => {
    try {
      await sequelize.authenticate();
      console.log('✅ PostgreSQL connected successfully!');
    } catch (error) {
      console.error('❌ Unable to connect to PostgreSQL:', error);
    }
  })();

  module.exports = sequelize;

// const connectDB = async () => {
//     try {
//         await mongoose.connect(process.env.MONGO_URI);
//         console.log('Connected to MongoDB Atlas');
//     } catch (error) {
//         console.error('Error connecting to MongoDB:', error);
//         process.exit(1);
//     }

// };

// module.exports = connectDB;