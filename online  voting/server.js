const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config();

// Centralized DB + models
const { connectDB, User, Candidate, Election, Vote } = require('./db');
connectDB().catch(err => console.error('MongoDB connection error:', err));

// Ensure default admin exists
async function ensureAdmin(){
  const admin = await User.findOne({ role: 'admin' }).exec();
  if(!admin){
    const hash = bcrypt.hashSync('admin123', 10);
    await User.create({ username: 'admin', password: hash, role: 'admin' });
    console.log('Created default admin -> username: admin password: admin123');
  }
}
ensureAdmin().catch(console.error);

const app = express();
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: false }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'verysecret_demo_key',
    resave: false,
    saveUninitialized: false,
  })
);

function requireLogin(req, res, next){
  if(!req.session.user) return res.redirect('/login');
  next();
}

function requireAdmin(req, res, next){
  if(!req.session.user || req.session.user.role !== 'admin')
    return res.status(403).send('Forbidden');
  next();
}

// HOME
app.get('/', (req, res) => {
  if(req.session.user){
    if(req.session.user.role === 'admin') return res.redirect('/admin');
    return res.redirect('/vote');
  }
  res.render('index', { user: req.session.user });
});

// REGISTRATION
app.get('/register', (req, res) =>
  res.render('register', { message: null, user: req.session.user })
);

app.post('/register', async (req, res) => {
  const { username, password, voterNo } = req.body;
  if(!username || !password || !voterNo)
    return res.render('register', { message: 'Fill all fields', user: req.session.user });

  try {
    const hash = bcrypt.hashSync(password, 10);
    await User.create({ username, password: hash, role: 'voter', voterNo });

    return res.render('login', {
      message: 'Registered successfully - please login',
      user: req.session.user
    });
  } catch (err) {
    return res.render('register', { message: 'Username taken or error', user: req.session.user });
  }
});

// LOGIN
app.get('/login', (req, res) =>
  res.render('login', { message: null, user: req.session.user })
);

app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  const user = await User.findOne({ username }).exec();
  if(!user)
    return res.render('login', { message: 'Invalid credentials', user: req.session.user });

  if(!bcrypt.compareSync(password, user.password))
    return res.render('login', { message: 'Invalid credentials', user: req.session.user });

  // session user
  req.session.user = { id: user._id.toString(), username: user.username, role: user.role };
  if(user.role !== 'admin') req.session.user.voterNo = user.voterNo;

  if(user.role === 'admin') return res.redirect('/admin');
  res.redirect('/vote');
});

// LOGOUT
app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// ADMIN DASHBOARD
app.get('/admin', requireAdmin, async (req, res) => {
  const candidates = await Candidate.find().exec();
  const election = await Election.findOne().exec();

  // vote tally
  const tally = await Vote.aggregate([
    { $group: { _id: '$candidate', count: { $sum: 1 } } },
  ]).exec();

  const tallyMap = {};
  for(const t of tally) tallyMap[t._id.toString()] = t.count;

  const display = candidates.map(c => ({
    id: c._id.toString(),
    name: c.name,
    votes: tallyMap[c._id.toString()] || 0,
  }));

  res.render('admin', {
    user: req.session.user,
    candidates: display,
    election: election || {},
    users: await User.find().exec(),
  });
});

// ADMIN – Add Candidate
app.post('/admin/candidates/add', requireAdmin, async (req, res) => {
  const { name } = req.body;
  if(!name) return res.redirect('/admin');
  await Candidate.create({ name });
  res.redirect('/admin');
});

// ADMIN – Edit Candidate Form
app.get('/admin/candidates/:id/edit', requireAdmin, async (req, res) => {
  const cand = await Candidate.findById(req.params.id).exec();
  if(!cand) return res.redirect('/admin');

  res.render('admin_edit_candidate', { user: req.session.user, candidate: cand });
});

// ADMIN – Save Edited Candidate
app.post('/admin/candidates/:id/edit', requireAdmin, async (req, res) => {
  await Candidate.findByIdAndUpdate(req.params.id, { name: req.body.name }).exec();
  res.redirect('/admin');
});

// ADMIN – Delete Candidate
app.post('/admin/candidates/:id/delete', requireAdmin, async (req, res) => {
  const id = req.params.id;
  await Candidate.findByIdAndDelete(id).exec();
  await Vote.deleteMany({ candidate: id }).exec();
  res.redirect('/admin');
});

// ADMIN – Create/Update Election Schedule
app.post('/admin/election/create', requireAdmin, async (req, res) => {
  const { startDate, endDate } = req.body;
  if (!startDate || !endDate) return res.redirect('/admin');

  let election = await Election.findOne().exec();
  if(!election) election = new Election();

  election.startDate = new Date(startDate);
  election.endDate = new Date(endDate);
  election.active = true;
  election.published = false;

  await election.save();
  res.redirect('/admin');
});

// ADMIN – Publish Results (FIXED duplicate)
app.post('/admin/publish', requireAdmin, async (req, res) => {
  let election = await Election.findOne().exec();
  if(!election) {
    election = new Election({ startDate: null, endDate: null, active: false });
  }
  election.published = true;
  await election.save();
  res.redirect('/admin');
});

// ADMIN – Manual start/stop endpoints
app.post('/admin/election/start', requireAdmin, async (req, res) => {
  let election = await Election.findOne().exec();
  if(!election) {
    election = new Election({ startDate: null, endDate: null, active: true, published: false });
  } else {
    election.active = true;
  }
  await election.save();
  res.redirect('/admin');
});

app.post('/admin/election/stop', requireAdmin, async (req, res) => {
  const election = await Election.findOne().exec();
  if(election) {
    election.active = false;
    await election.save();
  }
  res.redirect('/admin');
});

// USER — Voting Page
app.get('/vote', requireLogin, async (req, res) => {
  const user = await User.findById(req.session.user.id).exec();
  const election = await Election.findOne().exec();
  const candidates = await Candidate.find().exec();

  const already = await Vote.findOne({ user: user._id }).exec();

  let votingOpen = false;
  const now = new Date();

  if(election){
    if(election.startDate && election.endDate){
      const start = new Date(election.startDate);
      const end = new Date(election.endDate);
      votingOpen = election.active && now >= start && now <= end;
    } else {
      votingOpen = !!election.active;
    }
  }

  res.render('vote', {
    user: req.session.user,
    candidates,
    electionActive: election ? election.active : false,
    votingOpen,
    message: already ? 'You have already voted' : null,
    schedule: election,
    alreadyVoted: !!already,
    voterNo: user ? user.voterNo : '',
  });
});

// USER — Submit Vote
app.post('/vote', requireLogin, async (req, res) => {
  const { candidateId, voterNo } = req.body;

  const user = await User.findById(req.session.user.id).exec();
  if(user.role === 'admin') return res.redirect('/admin');

  const election = await Election.findOne().exec();
  const now = new Date();

  let votingOpen = false;
  if(election){
    if(election.startDate && election.endDate){
      const start = new Date(election.startDate);
      const end = new Date(election.endDate);
      votingOpen = election.active && now >= start && now <= end;
    } else {
      votingOpen = !!election.active;
    }
  }

  if(!election)
    return res.render('vote', {
      user: req.session.user,
      candidates: [],
      electionActive: false,
      votingOpen: false,
      message: 'No election scheduled',
      schedule: election,
      voterNo: user.voterNo,
    });

  if(!votingOpen)
    return res.render('vote', {
      user: req.session.user,
      candidates: await Candidate.find().exec(),
      electionActive: election.active,
      votingOpen,
      message: 'Voting is not open at this time',
      schedule: election,
      voterNo: user.voterNo,
    });

  if(user.voterNo !== voterNo)
    return res.render('vote', {
      user: req.session.user,
      candidates: await Candidate.find().exec(),
      electionActive: election.active,
      votingOpen,
      message: 'Voter number mismatch',
      schedule: election,
      voterNo: user.voterNo,
    });

  const already = await Vote.findOne({ user: user._id }).exec();
  if(already)
    return res.render('vote', {
      user: req.session.user,
      candidates: await Candidate.find().exec(),
      electionActive: election.active,
      votingOpen,
      message: 'You already voted',
      schedule: election,
      voterNo: user.voterNo,
    });

  const candidate = await Candidate.findById(candidateId).exec();
  if(!candidate)
    return res.render('vote', {
      user: req.session.user,
      candidates: await Candidate.find().exec(),
      electionActive: election.active,
      votingOpen,
      message: 'Invalid candidate',
      schedule: election,
      voterNo: user.voterNo,
    });

  await Vote.create({ user: user._id, candidate: candidate._id });

  await User.findByIdAndUpdate(user._id, {
    voted: true,
    votedAt: new Date(),
    votedCandidate: candidate._id,
  }).exec();

  res.render('vote', {
    user: req.session.user,
    candidates: await Candidate.find().exec(),
    electionActive: election.active,
    votingOpen,
    message: 'Vote recorded. Thank you!',
    schedule: election,
    alreadyVoted: true,
    voterNo: user.voterNo,
  });
});

// SCHEDULE VIEW
app.get('/schedule', requireLogin, async (req, res) => {
  const election = await Election.findOne().exec();
  res.render('schedule', { user: req.session.user, schedule: election });
});

// PROFILE
app.get('/profile', requireLogin, async (req, res) => {
  const user = await User.findById(req.session.user.id)
    .populate('votedCandidate')
    .exec();

  const votedCandidateName = user.votedCandidate ? user.votedCandidate.name : null;

  res.render('profile', {
    user: {
      username: user.username,
      voterNo: user.voterNo,
      role: user.role,
      voted: user.voted,
      votedAt: user.votedAt,
    },
    votedCandidateName,
  });
});

// VERIFY VOTER
app.get('/verify', (req, res) =>
  res.render('verify', { user: req.session.user, result: null })
);

app.post('/verify', async (req, res) => {
  const { voterNo } = req.body;

  const user = await User.findOne({ voterNo }).exec();
  const election = await Election.findOne().exec();

  if(!user)
    return res.render('verify', {
      user: req.session.user,
      result: { ok: false, message: 'Voter not found' },
    });

  res.render('verify', {
    user: req.session.user,
    result: { ok: true, username: user.username, voterNo: user.voterNo, schedule: election },
  });
});

// PUBLIC RESULTS
app.get('/results', async (req, res) => {
  const election = await Election.findOne().exec();
  const published = election && election.published;

  if(!published && (!req.session.user || req.session.user.role !== 'admin')){
    return res.render('results', {
      user: req.session.user,
      published: false,
      message: 'Results are not published yet.',
    });
  }

  const tally = await Vote.aggregate([
    { $group: { _id: '$candidate', count: { $sum: 1 } } },
  ]).exec();

  const candidates = await Candidate.find().exec();
  const tallyMap = {};
  for(const t of tally) tallyMap[t._id.toString()] = t.count;

  const display = candidates.map(c => ({
    id: c._id.toString(),
    name: c.name,
    votes: tallyMap[c._id.toString()] || 0,
  }));

  const totalVotes = display.reduce((s, i) => s + (i.votes || 0), 0);

  res.render('results', { user: req.session.user, published: true, tally: display, totalVotes });
});

// FIXED PORT (no more 3000 conflicts)
const PORT = 3001;  
app.listen(PORT, () =>
  console.log(`Voting system running on http://localhost:${PORT}`)
);
