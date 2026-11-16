import { userModel } from '../models/userModel.js';
import { authService } from '../services/authService.js';

export const authController = {
  async register(req, res) {
    try {
      const { full_name, email, password, role } = req.body;

      if (!full_name || !email || !password) {
        return res.status(400).json({ error: 'Please provide full_name, email, and password.' });
      }

      const existingUser = await userModel.findByEmail(email);
      if (existingUser) {
        return res.status(409).json({ error: 'User with this email already exists.' });
      }

      const passwordHash = await authService.hashPassword(password);
      const newUser = await userModel.createUser(full_name, email, passwordHash, role || 'student');
      const token = authService.generateToken(newUser);

      return res.status(201).json({
        message: 'User registered successfully',
        token,
        user: newUser
      });
    } catch (error) {
      console.error('Registration error:', error);
      return res.status(500).json({ error: 'Internal server error during registration.' });
    }
  },

  async login(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Please provide email and password.' });
      }

      const user = await userModel.findByEmail(email);
      if (!user) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      const isMatch = await authService.comparePassword(password, user.password_hash);
      if (!isMatch) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      const token = authService.generateToken(user);

      return res.status(200).json({
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          role: user.role
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({ error: 'Internal server error during login.' });
    }
  }
};