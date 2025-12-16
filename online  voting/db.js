const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/voting-demo';

async function connectDB(){
  await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to MongoDB');
}

// Schemas
const userSchema = new mongoose.Schema({ username: { type: String, unique: true }, password: String, role: { type: String, default: 'voter' }, voterNo: String, voted: { type: Boolean, default: false }, votedAt: Date, votedCandidate: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate' } });
const candidateSchema = new mongoose.Schema({ name: String });
const electionSchema = new mongoose.Schema({ startDate: Date, endDate: Date, active: { type: Boolean, default: false }, published: { type: Boolean, default: false } });
const voteSchema = new mongoose.Schema({ user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate' }, date: { type: Date, default: Date.now } });

const User = mongoose.models.User || mongoose.model('User', userSchema);
const Candidate = mongoose.models.Candidate || mongoose.model('Candidate', candidateSchema);
const Election = mongoose.models.Election || mongoose.model('Election', electionSchema);
const Vote = mongoose.models.Vote || mongoose.model('Vote', voteSchema);

module.exports = { connectDB, mongoose, User, Candidate, Election, Vote };
