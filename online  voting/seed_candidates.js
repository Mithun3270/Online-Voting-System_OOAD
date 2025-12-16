const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/voting-demo';

const candidateSchema = new mongoose.Schema({ name: String });
const Candidate = mongoose.model('Candidate', candidateSchema);

async function seed(){
  await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to MongoDB');
  const samples = ['Alice', 'Bob', 'Charlie', 'Diana'];
  for(const name of samples){
    const exists = await Candidate.findOne({ name }).exec();
    if(!exists) await Candidate.create({ name });
  }
  console.log('Seeded candidates:', samples.join(', '));
  await mongoose.disconnect();
}

seed().catch(err => { console.error(err); process.exit(1); });
