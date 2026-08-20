const mongoose = require('mongoose');

const connectDB = async () => {
  const defaultUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smart_timetable_db';
  
  try {
    // Attempt connecting to local / configured MongoDB with a 3-second timeout
    const conn = await mongoose.connect(defaultUri, {
      serverSelectionTimeoutMS: 3000,
    });
    console.log(`\n✅ [MongoDB Connected]: ${conn.connection.host}/${conn.connection.name}`);
    
    // Check if database is empty, auto-seed if needed
    const User = require('../models/User');
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log('⚡ [Auto-Seeder] Database is empty. Seeding initial demo data...');
      const { seedDataInline } = require('../utils/seederHelper');
      await seedDataInline();
    }
  } catch (error) {
    console.warn(`\n⚠️  [Local MongoDB Not Found]: ${error.message}`);
    console.log('🔄 [Auto Fallback] Initializing high-speed In-Memory MongoDB Engine (No local MongoDB installation required!)...');
    
    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const mongod = await MongoMemoryServer.create();
      const inMemoryUri = mongod.getUri();
      
      const conn = await mongoose.connect(inMemoryUri);
      console.log(`\n🚀 [In-Memory MongoDB Started]: ${inMemoryUri}`);
      console.log('🌱 [Auto-Seeding] Populating in-memory database with demo accounts & timetables...');
      
      const { seedDataInline } = require('../utils/seederHelper');
      await seedDataInline();
      console.log('✅ [Ready] In-memory database loaded successfully with demo accounts!\n');
    } catch (memError) {
      console.error('❌ Failed to start in-memory MongoDB:', memError.message);
      console.log('Please ensure local MongoDB is running or provide a valid MONGO_URI in backend/.env');
    }
  }
};

module.exports = connectDB;
