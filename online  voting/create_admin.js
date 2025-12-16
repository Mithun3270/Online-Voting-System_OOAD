// Usage: node create_admin.js <username> <password>
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/voting-demo';

async function run(){
  const [,, username, password] = process.argv;
  if(!username || !password){
    console.error('Usage: node create_admin.js <username> <password>');
    process.exit(1);
  }
  await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  const userSchema = new mongoose.Schema({ username: { type: String, unique: true }, password: String, role: String, voterNo: String });
  const User = mongoose.model('User', userSchema);
  const hash = bcrypt.hashSync(password, 10);
  const existing = await User.findOne({ username }).exec();
  if(existing){
    existing.password = hash;
    existing.role = 'admin';
    await existing.save();
    console.log('Updated existing user to admin:', username);
  } else {
    await User.create({ username, password: hash, role: 'admin' });
    console.log('Created admin user:', username);
  }
  mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
