const User = require('../models/User');

// Helper to auto-seed default admin and cashiers if none exist
const seedInitialUsers = async () => {
  try {
    const count = await User.countDocuments();
    if (count === 0) {
      console.log('🌱 Seeding initial admin and cashier accounts...');

      // Admin Account
      const admin = new User({
        username: 'admin',
        name: 'Store Manager (Admin)',
        role: 'admin',
      });
      admin.setPassword('admin123');
      await admin.save();

      // Cashier 1 Account
      const cashier1 = new User({
        username: 'cashier1',
        name: 'Staff - Counter 1',
        role: 'cashier',
      });
      cashier1.setPassword('cashier123');
      await cashier1.save();

      // Cashier 2 Account
      const cashier2 = new User({
        username: 'cashier2',
        name: 'Staff - Counter 2',
        role: 'cashier',
      });
      cashier2.setPassword('cashier123');
      await cashier2.save();

      console.log('✅ Default users created: admin/admin123, cashier1/cashier123, cashier2/cashier123');
    }
  } catch (err) {
    console.error('Error seeding users:', err.message);
  }
};

// Login controller
exports.login = async (req, res) => {
  try {
    await seedInitialUsers();

    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required' });
    }

    const user = await User.findOne({ username: username.toLowerCase().trim() });
    if (!user || !user.active) {
      return res.status(401).json({ success: false, message: 'Invalid username or account disabled' });
    }

    if (!user.validPassword(password)) {
      return res.status(401).json({ success: false, message: 'Incorrect password' });
    }

    return res.json({
      success: true,
      message: `Welcome, ${user.name}!`,
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Get current user list (Admin only)
exports.getUsers = async (req, res) => {
  try {
    await seedInitialUsers();
    const users = await User.find({}, '-password -salt').sort({ role: 1, createdAt: 1 });
    return res.json({ success: true, data: users });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Explicit trigger to seed users
exports.seedUsers = async (req, res) => {
  try {
    await seedInitialUsers();
    const users = await User.find({}, 'username name role');
    return res.json({ success: true, message: 'Users ready', data: users });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
