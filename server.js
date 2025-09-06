const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
require('dotenv').config();

// Face++ API config
const FACEPP_API_KEY = process.env.FACEPP_API_KEY || '';
const FACEPP_API_SECRET = process.env.FACEPP_API_SECRET || '';
const FACEPP_DETECT_URL = 'https://api-us.faceplusplus.com/facepp/v3/detect';
const FACEPP_COMPARE_URL = 'https://api-us.faceplusplus.com/facepp/v3/compare';

async function faceppDetectGetToken(imageBase64) {
  if (!FACEPP_API_KEY || !FACEPP_API_SECRET) {
    throw new Error('Face++ not configured');
  }
  const form = new URLSearchParams();
  form.append('api_key', FACEPP_API_KEY);
  form.append('api_secret', FACEPP_API_SECRET);
  form.append('image_base64', imageBase64);
  form.append('return_landmark', '0');
  form.append('return_attributes', 'none');

  const resp = await axios.post(FACEPP_DETECT_URL, form.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15000
  });
  if (!resp.data || !Array.isArray(resp.data.faces) || resp.data.faces.length === 0) {
    throw new Error('No face detected');
  }
  return resp.data.faces[0].face_token;
}

async function faceppCompare(faceToken1, imageBase64) {
  const form = new URLSearchParams();
  form.append('api_key', FACEPP_API_KEY);
  form.append('api_secret', FACEPP_API_SECRET);
  form.append('face_token1', faceToken1);
  form.append('image_base64_2', imageBase64);

  const resp = await axios.post(FACEPP_COMPARE_URL, form.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15000
  });
  if (!resp.data || typeof resp.data.confidence !== 'number') {
    throw new Error('Invalid compare response');
  }
  // Face++ confidence is roughly 0-100
  return resp.data.confidence / 100;
}

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'attendance-app-professional-2024';

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Enhanced middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));
app.use('/uploads', express.static(uploadsDir));

// Professional logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.url;
  const ip = req.ip || req.connection.remoteAddress;
  console.log(`[${timestamp}] ${method} ${url} - ${ip}`);
  next();
});

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/attendance_professional';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).catch(error => {
  console.error('MongoDB connection error:', error);
});

// Helper: compute cosine similarity between two numeric arrays
function computeCosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || b.length === 0 || a.length !== b.length) {
    return 0;
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const va = Number(a[i]);
    const vb = Number(b[i]);
    if (Number.isNaN(va) || Number.isNaN(vb)) return 0;
    dot += va * vb;
    normA += va * va;
    normB += vb * vb;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// External Face API config
const FACE_API_URL = process.env.FACE_API_URL || '';
const FACE_API_KEY = process.env.FACE_API_KEY || '';

async function getEmbeddingFromExternalApi(imageBase64) {
  if (!FACE_API_URL || !FACE_API_KEY) {
    throw new Error('Face API not configured');
  }
  const response = await axios.post(
    FACE_API_URL,
    { imageBase64 },
    { headers: { 'Authorization': `Bearer ${FACE_API_KEY}`, 'Content-Type': 'application/json' }, timeout: 15000 }
  );
  if (!response.data || !Array.isArray(response.data.embedding)) {
    throw new Error('Invalid embedding response');
  }
  return response.data.embedding;
}

// Enhanced User Schema
const userSchema = new mongoose.Schema({
  role: { 
    type: String, 
    enum: ['admin', 'student'], 
    required: true 
  },
  // Admin fields
  adminName: { 
    type: String, 
    required: function() { return this.role === 'admin'; }
  },
  uniqueId: { 
    type: String, 
    unique: true, 
    sparse: true,
    required: function() { return this.role === 'admin'; }
  },
  password: { 
    type: String,
    required: function() { return this.role === 'admin'; }
  },
  adminLevel: {
    type: String,
    enum: ['super_admin', 'admin', 'teacher'],
    default: 'admin'
  },
  // Student fields
  studentName: { 
    type: String,
    required: function() { return this.role === 'student'; }
  },
  studentId: { 
    type: String, 
    unique: true, 
    sparse: true,
    required: function() { return this.role === 'student'; }
  },
  dateOfBirth: { 
    type: Date,
    required: function() { return this.role === 'student'; }
  },
  enrolledCourses: [{
    type: String,
    default: []
  }],
  faceEncodings: [Number],
  faceToken: String,
  profileImage: String,
  phoneNumber: String,
  email: String,
  address: String,
  emergencyContact: {
    name: String,
    phone: String,
    relationship: String
  },
  academicYear: String,
  semester: String,
  isActive: { 
    type: Boolean, 
    default: true 
  },
  lastLogin: Date,
  loginCount: { type: Number, default: 0 },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Enhanced Course Schema
const courseSchema = new mongoose.Schema({
  courseCode: { 
    type: String, 
    unique: true, 
    required: true,
    uppercase: true
  },
  courseName: { 
    type: String, 
    required: true 
  },
  instructor: String,
  department: String,
  credits: { type: Number, default: 3 },
  description: String,
  schedule: {
    days: [String],
    time: String,
    room: String
  },
  enrolledStudents: [{
    type: String,
    default: []
  }],
  maxCapacity: { type: Number, default: 50 },
  semester: String,
  academicYear: String,
  isActive: { 
    type: Boolean, 
    default: true 
  },
  createdBy: String,
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

// New Material Schema
const materialSchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: true 
  },
  description: String,
  courseCode: { 
    type: String, 
    required: true 
  },
  materialType: {
    type: String,
    enum: ['pdf', 'image', 'document', 'link', 'video'],
    required: true
  },
  filePath: String,
  fileSize: Number,
  fileName: String,
  url: String,
  isPublic: { type: Boolean, default: true },
  publishDate: { type: Date, default: Date.now },
  dueDate: Date,
  uploadedBy: { 
    type: String, 
    required: true 
  },
  tags: [String],
  downloadCount: { type: Number, default: 0 },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Enhanced Attendance Schema
const attendanceSchema = new mongoose.Schema({
  studentId: { 
    type: String, 
    required: true 
  },
  studentName: String,
  courseCode: { 
    type: String, 
    required: true 
  },
  timestamp: { 
    type: Date, 
    default: Date.now 
  },
  date: { 
    type: String, 
    required: true 
  },
  status: { 
    type: String, 
    enum: ['present', 'absent', 'late', 'excused'], 
    default: 'present' 
  },
  confidenceScore: {
    type: Number,
    min: 0,
    max: 1,
    default: 0.95
  },
  location: {
    latitude: Number,
    longitude: Number
  },
  deviceInfo: String,
  ipAddress: String,
  method: {
    type: String,
    enum: ['face_recognition', 'manual', 'qr_code'],
    default: 'face_recognition'
  },
  notes: String,
  verifiedBy: String,
  isLate: { type: Boolean, default: false },
  lateMinutes: { type: Number, default: 0 },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

// New Notification Schema
const notificationSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: {
    type: String,
    enum: ['info', 'warning', 'success', 'error'],
    default: 'info'
  },
  isRead: { type: Boolean, default: false },
  courseCode: String,
  actionUrl: String,
  createdAt: { type: Date, default: Date.now }
});

// Create indexes for better performance
attendanceSchema.index({ studentId: 1, courseCode: 1, date: 1 }, { unique: true });
materialSchema.index({ courseCode: 1, isActive: 1 });
notificationSchema.index({ userId: 1, isRead: 1 });

// Models
const User = mongoose.model('User', userSchema);
const Course = mongoose.model('Course', courseSchema);
const Attendance = mongoose.model('Attendance', attendanceSchema);
const Material = mongoose.model('Material', materialSchema);
const Notification = mongoose.model('Notification', notificationSchema);

// Enhanced file upload configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(uploadsDir, 'materials');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: { 
    fileSize: 50 * 1024 * 1024 // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images, PDFs, and documents are allowed.'));
    }
  }
});

// JWT Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      success: false,
      error: 'Access token required' 
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ 
        success: false,
        error: 'Invalid or expired token' 
      });
    }
    req.user = user;
    next();
  });
};

// Role-based middleware
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Admin access required'
    });
  }
  next();
};

const requireStudent = (req, res, next) => {
  if (req.user.role !== 'student') {
    return res.status(403).json({
      success: false,
      error: 'Student access required'
    });
  }
  next();
};

// Utility function to create notifications
const createNotification = async (userId, title, message, type = 'info', courseCode = null) => {
  try {
    const notification = new Notification({
      userId,
      title,
      message,
      type,
      courseCode
    });
    await notification.save();
  } catch (error) {
    console.error('Error creating notification:', error);
  }
};

// Enhanced health check endpoint
app.get('/api/health', (req, res) => {
  const healthCheck = {
    success: true,
    status: 'Server running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: '2.0.0'
  };
  res.json(healthCheck);
});

// Enhanced Authentication Routes

// Admin Registration
app.post('/api/auth/admin/register', async (req, res) => {
  try {
    const { adminName, uniqueId, password, adminLevel, email, phoneNumber } = req.body;

    if (!adminName || !uniqueId || !password) {
      return res.status(400).json({
        success: false,
        error: 'Admin name, unique ID, and password are required'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters long'
      });
    }

    const existingAdmin = await User.findOne({ 
      $or: [
        { uniqueId: uniqueId.trim() },
        { email: email }
      ]
    });

    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        error: 'Admin with this unique ID or email already exists'
      });
    }

    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const admin = new User({
      role: 'admin',
      adminName: adminName.trim(),
      uniqueId: uniqueId.trim(),
      password: hashedPassword,
      adminLevel: adminLevel || 'admin',
      email: email?.trim(),
      phoneNumber: phoneNumber?.trim()
    });

    const savedAdmin = await admin.save();

    res.status(201).json({
      success: true,
      message: 'Admin registered successfully',
      data: {
        adminId: savedAdmin._id,
        adminName: savedAdmin.adminName,
        uniqueId: savedAdmin.uniqueId,
        adminLevel: savedAdmin.adminLevel
      }
    });

  } catch (error) {
    console.error('Admin registration error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: 'Unique ID already exists'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Registration failed. Please try again.'
    });
  }
});

// Enhanced Admin Login
app.post('/api/auth/admin/login', async (req, res) => {
  try {
    const { uniqueId, password } = req.body;

    if (!uniqueId || !password) {
      return res.status(400).json({
        success: false,
        error: 'Unique ID and password are required'
      });
    }

    const admin = await User.findOne({ 
      uniqueId: uniqueId.trim(), 
      role: 'admin',
      isActive: true 
    });

    if (!admin) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    const isValidPassword = await bcrypt.compare(password, admin.password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Update login statistics
    admin.lastLogin = new Date();
    admin.loginCount += 1;
    await admin.save();

    const token = jwt.sign(
      { 
        userId: admin._id, 
        role: admin.role, 
        uniqueId: admin.uniqueId,
        adminLevel: admin.adminLevel
      }, 
      JWT_SECRET, 
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: admin._id,
          role: admin.role,
          adminName: admin.adminName,
          uniqueId: admin.uniqueId,
          adminLevel: admin.adminLevel,
          email: admin.email,
          phoneNumber: admin.phoneNumber,
          lastLogin: admin.lastLogin
        }
      }
    });

  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed. Please try again.'
    });
  }
});

// Enhanced Student Login
app.post('/api/auth/student/login', async (req, res) => {
  try {
    const { studentId } = req.body;

    if (!studentId) {
      return res.status(400).json({
        success: false,
        error: 'Student ID is required'
      });
    }

    const student = await User.findOne({ 
      studentId: studentId.trim(), 
      role: 'student',
      isActive: true 
    });

    if (!student) {
      return res.status(401).json({
        success: false,
        error: 'Student not found or inactive'
      });
    }

    // Update login statistics
    student.lastLogin = new Date();
    student.loginCount += 1;
    await student.save();

    const token = jwt.sign(
      { 
        userId: student._id, 
        role: student.role, 
        studentId: student.studentId 
      }, 
      JWT_SECRET, 
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: student._id,
          role: student.role,
          studentName: student.studentName,
          studentId: student.studentId,
          enrolledCourses: student.enrolledCourses,
          academicYear: student.academicYear,
          semester: student.semester,
          lastLogin: student.lastLogin
        }
      }
    });

  } catch (error) {
    console.error('Student login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed. Please try again.'
    });
  }
});

// Student Face Registration (stores face encodings for the logged-in student)
app.post('/api/student/face/register', authenticateToken, requireStudent, async (req, res) => {
  try {
    const { encodings } = req.body;

    if (!encodings || !Array.isArray(encodings) || encodings.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid face encodings array is required'
      });
    }

    // Basic validation: ensure numbers and reasonable length (e.g., 64-512 dims)
    const areNumbers = encodings.every(v => typeof v === 'number' && Number.isFinite(v));
    if (!areNumbers || encodings.length < 64 || encodings.length > 1024) {
      return res.status(400).json({
        success: false,
        error: 'Face encodings must be a numeric array of length between 64 and 1024'
      });
    }

    const student = await User.findOne({ studentId: req.user.studentId, role: 'student', isActive: true });
    if (!student) {
      return res.status(404).json({ success: false, error: 'Student not found' });
    }

    student.faceEncodings = encodings;
    await student.save();

    res.json({ success: true, message: 'Face encodings registered successfully' });
  } catch (error) {
    console.error('Face registration error:', error);
    res.status(500).json({ success: false, error: 'Failed to register face' });
  }
});

// Face encoding endpoint (diagnostics)
app.post('/api/face/encode', authenticateToken, async (req, res) => {
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ success: false, error: 'imageBase64 is required' });
    }
    const embedding = await getEmbeddingFromExternalApi(imageBase64);
    return res.json({ success: true, data: { embedding } });
  } catch (error) {
    console.error('Face encode error:', error.message || error);
    res.status(500).json({ success: false, error: 'Failed to generate face embedding' });
  }
});

// Student Face Registration via image
app.post('/api/student/face/register-image', authenticateToken, requireStudent, async (req, res) => {
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ success: false, error: 'imageBase64 is required' });
    }

    // Primary: Face++ token
    let faceToken;
    try {
      faceToken = await faceppDetectGetToken(imageBase64);
    } catch (e) {
      return res.status(400).json({ success: false, error: 'Face not detected. Please try again.' });
    }

    const student = await User.findOne({ studentId: req.user.studentId, role: 'student', isActive: true });
    if (!student) {
      return res.status(404).json({ success: false, error: 'Student not found' });
    }

    student.faceToken = faceToken;
    await student.save();

    res.json({ success: true, message: 'Face registered successfully' });
  } catch (error) {
    console.error('Register image face error:', error.message || error);
    res.status(500).json({ success: false, error: 'Failed to register face' });
  }
});

// Attendance via image (Face++ compare)
app.post('/api/student/attendance-image', authenticateToken, requireStudent, async (req, res) => {
  try {
    const { courseCode, imageBase64, location, notes } = req.body;
    const studentId = req.user.studentId;

    if (!courseCode) {
      return res.status(400).json({ success: false, error: 'Course code is required' });
    }
    if (!imageBase64) {
      return res.status(400).json({ success: false, error: 'imageBase64 is required' });
    }

    const student = await User.findOne({ studentId: studentId, role: 'student', isActive: true });
    if (!student) {
      return res.status(404).json({ success: false, error: 'Student not found' });
    }
    if (!student.enrolledCourses.includes(courseCode.toUpperCase())) {
      return res.status(400).json({ success: false, error: 'You are not enrolled in this course' });
    }

    const course = await Course.findOne({ courseCode: courseCode.toUpperCase(), isActive: true });
    if (!course) {
      return res.status(404).json({ success: false, error: 'Course not found' });
    }

    const today = new Date().toISOString().split('T')[0];
    const existingAttendance = await Attendance.findOne({ studentId: studentId, courseCode: courseCode.toUpperCase(), date: today });
    if (existingAttendance) {
      return res.status(400).json({ success: false, error: 'Attendance already marked for today in this course' });
    }

    if (!student.faceToken) {
      return res.status(400).json({ success: false, error: 'No registered face found. Please register your face first.' });
    }

    let similarity;
    try {
      similarity = await faceppCompare(student.faceToken, imageBase64);
    } catch (e) {
      return res.status(400).json({ success: false, error: 'Face verification failed. Please try again.' });
    }

    const SIMILARITY_THRESHOLD = 0.85; // 85% confidence
    if (similarity < SIMILARITY_THRESHOLD) {
      return res.status(400).json({ success: false, error: 'Face verification failed. Please try again.' });
    }

    const currentTime = new Date();
    const classStartTime = new Date();
    classStartTime.setHours(9, 0, 0, 0);

    let status = 'present';
    let isLate = false;
    let lateMinutes = 0;
    if (currentTime > classStartTime) {
      const diffMinutes = Math.floor((currentTime - classStartTime) / (1000 * 60));
      if (diffMinutes > 15) {
        isLate = true;
        lateMinutes = diffMinutes;
        status = 'late';
      }
    }

    const attendance = new Attendance({
      studentId: studentId,
      studentName: student.studentName,
      courseCode: courseCode.toUpperCase(),
      date: today,
      status: status,
      confidenceScore: similarity,
      location: location || { latitude: 0, longitude: 0 },
      deviceInfo: req.headers['user-agent'] || 'Unknown Device',
      ipAddress: req.ip || req.connection.remoteAddress,
      method: 'face_recognition',
      notes: notes?.trim(),
      isLate: isLate,
      lateMinutes: lateMinutes
    });

    const savedAttendance = await attendance.save();

    if (isLate) {
      await createNotification(studentId, 'Late Attendance Recorded', `You were marked late for ${courseCode} by ${lateMinutes} minutes.`, 'warning', courseCode.toUpperCase());
    }

    res.json({ success: true, message: `Attendance marked successfully${isLate ? ' (Late)' : ''}`, data: {
      attendanceId: savedAttendance._id,
      courseCode: savedAttendance.courseCode,
      timestamp: savedAttendance.timestamp,
      status: savedAttendance.status,
      confidenceScore: savedAttendance.confidenceScore,
      isLate: savedAttendance.isLate,
      lateMinutes: savedAttendance.lateMinutes
    }});

  } catch (error) {
    console.error('Attendance image error:', error.message || error);
    res.status(500).json({ success: false, error: 'Failed to mark attendance. Please try again.' });
  }
});

// Enhanced Student Creation
app.post('/api/admin/students', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { 
      studentName, 
      studentId, 
      dateOfBirth, 
      enrolledCourses, 
      faceImage, // Add this back
      email,
      phoneNumber,
      address,
      emergencyContact,
      academicYear,
      semester
    } = req.body;

    if (!studentName || !studentId || !dateOfBirth) {
      return res.status(400).json({
        success: false,
        error: 'Student name, ID, and date of birth are required'
      });
    }

    const existingStudent = await User.findOne({ 
      $or: [
        { studentId: studentId.trim() },
        { email: email }
      ]
    });

    if (existingStudent) {
      return res.status(400).json({
        success: false,
        error: 'Student with this ID or email already exists'
      });
    }

    const coursesToEnroll = enrolledCourses || [];
    if (coursesToEnroll.length > 0) {
      const existingCourses = await Course.find({ 
        courseCode: { $in: coursesToEnroll },
        isActive: true 
      });
      
      const foundCourseCodes = existingCourses.map(course => course.courseCode);
      const invalidCourses = coursesToEnroll.filter(code => !foundCourseCodes.includes(code));
      
      if (invalidCourses.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Invalid course codes: ${invalidCourses.join(', ')}`
        });
      }
    }

    const student = new User({
      role: 'student',
      studentName: studentName.trim(),
      studentId: studentId.trim(),
      dateOfBirth: new Date(dateOfBirth),
      enrolledCourses: coursesToEnroll,
      profileImage: faceImage || '',
      faceEncodings: [],
      email: email?.trim(),
      phoneNumber: phoneNumber?.trim(),
      address: address?.trim(),
      emergencyContact,
      academicYear: academicYear?.trim(),
      semester: semester?.trim()
    });

    const savedStudent = await student.save();

    // If face image is provided, register it
    if (faceImage) {
      try {
        // Convert base64 image to buffer and process
        const base64Data = faceImage.replace(/^data:image\/[a-z]+;base64,/, '');
        const faceToken = await faceppDetectGetToken(base64Data);
        savedStudent.faceToken = faceToken;
        await savedStudent.save();
      } catch (faceError) {
        console.error('Face registration failed during student creation:', faceError);
        // Don't fail the student creation, just log the error
      }
    }

    // Update course enrollments
    if (coursesToEnroll.length > 0) {
      await Course.updateMany(
        { courseCode: { $in: coursesToEnroll }, isActive: true },
        { $addToSet: { enrolledStudents: studentId.trim() } }
      );
    }

    // Create welcome notification
    await createNotification(
      savedStudent.studentId,
      'Welcome to the Attendance System',
      `Welcome ${studentName}! Your account has been created successfully.`,
      'success'
    );

    res.status(201).json({
      success: true,
      message: 'Student created successfully',
      data: {
        studentId: savedStudent._id,
        studentName: savedStudent.studentName,
        studentIdNumber: savedStudent.studentId,
        enrolledCourses: savedStudent.enrolledCourses,
        academicInfo: {
          academicYear: savedStudent.academicYear,
          semester: savedStudent.semester
        }
      }
    });

  } catch (error) {
    console.error('Create student error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: 'Student ID already exists'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to create student. Please try again.'
    });
  }
});

// Material Management Routes

// Upload Material
app.post('/api/admin/materials', authenticateToken, requireAdmin, upload.single('file'), async (req, res) => {
  try {
    const { title, description, courseCode, materialType, url, tags, publishDate, dueDate } = req.body;

    if (!title || !courseCode) {
      return res.status(400).json({
        success: false,
        error: 'Title and course code are required'
      });
    }

    // Verify course exists
    const course = await Course.findOne({ courseCode: courseCode.toUpperCase(), isActive: true });
    if (!course) {
      return res.status(404).json({
        success: false,
        error: 'Course not found'
      });
    }

    let materialData = {
      title: title.trim(),
      description: description?.trim(),
      courseCode: courseCode.toUpperCase(),
      materialType: materialType || 'document',
      uploadedBy: req.user.uniqueId,
      tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
      publishDate: publishDate ? new Date(publishDate) : new Date(),
      dueDate: dueDate ? new Date(dueDate) : null
    };

    if (req.file) {
      materialData.filePath = req.file.path;
      materialData.fileName = req.file.originalname;
      materialData.fileSize = req.file.size;
    } else if (url) {
      materialData.url = url.trim();
      materialData.materialType = 'link';
    }

    const material = new Material(materialData);
    const savedMaterial = await material.save();

    // Notify enrolled students
    const enrolledStudents = await User.find({ 
      role: 'student', 
      enrolledCourses: courseCode.toUpperCase(),
      isActive: true 
    });

    for (const student of enrolledStudents) {
      await createNotification(
        student.studentId,
        'New Material Available',
        `New material "${title}" has been uploaded for ${courseCode}`,
        'info',
        courseCode.toUpperCase()
      );
    }

    res.status(201).json({
      success: true,
      message: 'Material uploaded successfully',
      data: savedMaterial
    });

  } catch (error) {
    console.error('Upload material error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload material'
    });
  }
});

// Get Materials by Course
app.get('/api/materials/:courseCode', authenticateToken, async (req, res) => {
  try {
    const { courseCode } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const materials = await Material.find({
      courseCode: courseCode.toUpperCase(),
      isActive: true,
      publishDate: { $lte: new Date() }
    })
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

    const totalMaterials = await Material.countDocuments({
      courseCode: courseCode.toUpperCase(),
      isActive: true,
      publishDate: { $lte: new Date() }
    });

    res.json({
      success: true,
      data: {
        materials,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalMaterials / limit),
          totalMaterials,
          hasMore: page * limit < totalMaterials
        }
      }
    });

  } catch (error) {
    console.error('Get materials error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch materials'
    });
  }
});

// Download Material
app.get('/api/materials/download/:id', authenticateToken, async (req, res) => {
  try {
    const material = await Material.findById(req.params.id);
    
    if (!material || !material.isActive) {
      return res.status(404).json({
        success: false,
        error: 'Material not found'
      });
    }

    // Check if student is enrolled in the course
    if (req.user.role === 'student') {
      const student = await User.findOne({ studentId: req.user.studentId });
      if (!student.enrolledCourses.includes(material.courseCode)) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You are not enrolled in this course.'
        });
      }
    }

    // Increment download count
    material.downloadCount += 1;
    await material.save();

    if (material.filePath && fs.existsSync(material.filePath)) {
      res.download(material.filePath, material.fileName);
    } else {
      res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }

  } catch (error) {
    console.error('Download material error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to download material'
    });
  }
});

// Enhanced Attendance Marking
app.post('/api/student/attendance', authenticateToken, requireStudent, async (req, res) => {
  try {
    const { courseCode, faceData, location, notes } = req.body;
    const studentId = req.user.studentId;

    if (!courseCode) {
      return res.status(400).json({
        success: false,
        error: 'Course code is required'
      });
    }

    const student = await User.findOne({ 
      studentId: studentId, 
      role: 'student',
      isActive: true 
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Student not found'
      });
    }

    if (!student.enrolledCourses.includes(courseCode.toUpperCase())) {
      return res.status(400).json({
        success: false,
        error: 'You are not enrolled in this course'
      });
    }

    const course = await Course.findOne({ 
      courseCode: courseCode.toUpperCase(),
      isActive: true 
    });

    if (!course) {
      return res.status(404).json({
        success: false,
        error: 'Course not found'
      });
    }

    const today = new Date().toISOString().split('T')[0];
    const existingAttendance = await Attendance.findOne({
      studentId: studentId,
      courseCode: courseCode.toUpperCase(),
      date: today
    });

    if (existingAttendance) {
      return res.status(400).json({
        success: false,
        error: 'Attendance already marked for today in this course'
      });
    }

    // Enforce face verification using stored encodings
    if (!student.faceEncodings || !Array.isArray(student.faceEncodings) || student.faceEncodings.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No registered face encodings found. Please register your face first.'
      });
    }

    if (!faceData || !Array.isArray(faceData) || faceData.length !== student.faceEncodings.length) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or missing face data for verification'
      });
    }

    const similarity = computeCosineSimilarity(student.faceEncodings, faceData);
    const SIMILARITY_THRESHOLD = 0.85; // adjust as needed based on embedding scale

    if (similarity < SIMILARITY_THRESHOLD) {
      return res.status(400).json({
        success: false,
        error: 'Face verification failed. Please try again.'
      });
    }

    const currentTime = new Date();
    const classStartTime = new Date();
    classStartTime.setHours(9, 0, 0, 0); // Assuming 9 AM start time

    let status = 'present';
    let isLate = false;
    let lateMinutes = 0;

    if (currentTime > classStartTime) {
      const diffMinutes = Math.floor((currentTime - classStartTime) / (1000 * 60));
      if (diffMinutes > 15) {
        isLate = true;
        lateMinutes = diffMinutes;
        status = 'late';
      }
    }

    const attendance = new Attendance({
      studentId: studentId,
      studentName: student.studentName,
      courseCode: courseCode.toUpperCase(),
      date: today,
      status: status,
      confidenceScore: similarity,
      location: location || { latitude: 0, longitude: 0 },
      deviceInfo: req.headers['user-agent'] || 'Unknown Device',
      ipAddress: req.ip || req.connection.remoteAddress,
      method: 'face_recognition',
      notes: notes?.trim(),
      isLate: isLate,
      lateMinutes: lateMinutes
    });

    const savedAttendance = await attendance.save();

    if (isLate) {
      await createNotification(
        studentId,
        'Late Attendance Recorded',
        `You were marked late for ${courseCode} by ${lateMinutes} minutes.`,
        'warning',
        courseCode.toUpperCase()
      );
    }

    res.json({
      success: true,
      message: `Attendance marked successfully${isLate ? ' (Late)' : ''}`,
      data: {
        attendanceId: savedAttendance._id,
        courseCode: savedAttendance.courseCode,
        timestamp: savedAttendance.timestamp,
        status: savedAttendance.status,
        confidenceScore: savedAttendance.confidenceScore,
        isLate: savedAttendance.isLate,
        lateMinutes: savedAttendance.lateMinutes
      }
    });

  } catch (error) {
    console.error('Mark attendance error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: 'Attendance already marked for today'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to mark attendance. Please try again.'
    });
  }
});

// Enhanced Student Dashboard
app.get('/api/student/dashboard', authenticateToken, requireStudent, async (req, res) => {
  try {
    const studentId = req.user.studentId;
    
    const student = await User.findOne({ 
      studentId: studentId, 
      role: 'student',
      isActive: true 
    }).select('-faceEncodings -password');

    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Student not found'
      });
    }
    
    // Get attendance records
    const attendanceRecords = await Attendance.find({ studentId: studentId });
    
    // Calculate statistics
    const totalSessions = attendanceRecords.length;
    const presentSessions = attendanceRecords.filter(record => record.status === 'present').length;
    const lateSessions = attendanceRecords.filter(record => record.status === 'late').length;
    const absentSessions = totalSessions - presentSessions - lateSessions;
    const overallPercentage = totalSessions > 0 ? ((presentSessions + lateSessions) / totalSessions * 100).toFixed(1) : '0';

    // Get recent attendance
    const recentAttendance = await Attendance.find({ studentId: studentId })
      .sort({ timestamp: -1 })
      .limit(10);

    // Get course-wise statistics
    const courseStats = {};
    attendanceRecords.forEach(record => {
      if (!courseStats[record.courseCode]) {
        courseStats[record.courseCode] = { 
          total: 0, 
          present: 0, 
          late: 0, 
          absent: 0 
        };
      }
      courseStats[record.courseCode].total++;
      courseStats[record.courseCode][record.status]++;
    });

    // Calculate course percentages
    Object.keys(courseStats).forEach(courseCode => {
      const stats = courseStats[courseCode];
      stats.percentage = ((stats.present + stats.late) / stats.total * 100).toFixed(1);
    });

    // Get upcoming materials
    const upcomingMaterials = await Material.find({
      courseCode: { $in: student.enrolledCourses },
      isActive: true,
      publishDate: { $lte: new Date() },
      dueDate: { $gte: new Date() }
    })
    .sort({ dueDate: 1 })
    .limit(5);

    // Get notifications
    const notifications = await Notification.find({ 
      userId: studentId,
      isRead: false 
    })
    .sort({ createdAt: -1 })
    .limit(10);

    res.json({
      success: true,
      data: {
        student: {
          id: student._id,
          name: student.studentName,
          studentId: student.studentId,
          email: student.email,
          phoneNumber: student.phoneNumber,
          enrolledCourses: student.enrolledCourses,
          academicYear: student.academicYear,
          semester: student.semester,
          lastLogin: student.lastLogin
        },
        statistics: {
          totalSessions,
          presentSessions,
          lateSessions,
          absentSessions,
          overallPercentage: parseFloat(overallPercentage)
        },
        recentAttendance,
        courseStats,
        upcomingMaterials,
        notifications
      }
    });

  } catch (error) {
    console.error('Get student dashboard error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard data'
    });
  }
});

// Get Student Materials
app.get('/api/student/materials', authenticateToken, requireStudent, async (req, res) => {
  try {
    const studentId = req.user.studentId;
    const { courseCode, page = 1, limit = 20 } = req.query;

    const student = await User.findOne({ studentId, role: 'student' });
    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Student not found'
      });
    }

    let filter = {
      courseCode: { $in: student.enrolledCourses },
      isActive: true,
      publishDate: { $lte: new Date() }
    };

    if (courseCode) {
      filter.courseCode = courseCode.toUpperCase();
    }

    const materials = await Material.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const totalMaterials = await Material.countDocuments(filter);

    res.json({
      success: true,
      data: {
        materials,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalMaterials / limit),
          totalMaterials,
          hasMore: page * limit < totalMaterials
        }
      }
    });

  } catch (error) {
    console.error('Get student materials error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch materials'
    });
  }
});

// Get Notifications
app.get('/api/notifications', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.role === 'admin' ? req.user.uniqueId : req.user.studentId;
    const { page = 1, limit = 20, unreadOnly = false } = req.query;

    let filter = { userId };
    if (unreadOnly === 'true') {
      filter.isRead = false;
    }

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const totalNotifications = await Notification.countDocuments(filter);
    const unreadCount = await Notification.countDocuments({ userId, isRead: false });

    res.json({
      success: true,
      data: {
        notifications,
        unreadCount,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalNotifications / limit),
          totalNotifications,
          hasMore: page * limit < totalNotifications
        }
      }
    });

  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notifications'
    });
  }
});

// Mark Notification as Read
app.put('/api/notifications/:id/read', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.role === 'admin' ? req.user.uniqueId : req.user.studentId;
    
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found'
      });
    }

    res.json({
      success: true,
      message: 'Notification marked as read',
      data: notification
    });

  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update notification'
    });
  }
});

// Enhanced Admin Analytics
app.get('/api/admin/analytics', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate, courseCode } = req.query;

    let dateFilter = {};
    if (startDate || endDate) {
      dateFilter.timestamp = {};
      if (startDate) dateFilter.timestamp.$gte = new Date(startDate);
      if (endDate) dateFilter.timestamp.$lte = new Date(endDate);
    }

    let courseFilter = {};
    if (courseCode) {
      courseFilter.courseCode = courseCode.toUpperCase();
    }

    const attendanceFilter = { ...dateFilter, ...courseFilter };

    // Basic counts
    const totalStudents = await User.countDocuments({ role: 'student', isActive: true });
    const totalCourses = await Course.countDocuments({ isActive: true });
    const totalMaterials = await Material.countDocuments({ isActive: true });
    const totalAttendanceRecords = await Attendance.countDocuments(attendanceFilter);

    // Attendance statistics
    const attendanceStats = await Attendance.aggregate([
      { $match: attendanceFilter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    let presentCount = 0;
    let lateCount = 0;
    let absentCount = 0;
    
    attendanceStats.forEach(stat => {
      if (stat._id === 'present') presentCount = stat.count;
      if (stat._id === 'late') lateCount = stat.count;
      if (stat._id === 'absent') absentCount = stat.count;
    });

    // Course-wise performance
    const coursePerformance = await Attendance.aggregate([
      { $match: attendanceFilter },
      {
        $group: {
          _id: '$courseCode',
          totalSessions: { $sum: 1 },
          presentSessions: {
            $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] }
          },
          lateSessions: {
            $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] }
          },
          uniqueStudents: { $addToSet: '$studentId' }
        }
      },
      {
        $project: {
          courseCode: '$_id',
          totalSessions: 1,
          presentSessions: 1,
          lateSessions: 1,
          studentCount: { $size: '$uniqueStudents' },
          attendanceRate: {
            $multiply: [
              { 
                $divide: [
                  { $add: ['$presentSessions', '$lateSessions'] }, 
                  '$totalSessions'
                ] 
              },
              100
            ]
          }
        }
      },
      { $sort: { courseCode: 1 } }
    ]);

    // Top performing students
    const topStudents = await Attendance.aggregate([
      { $match: attendanceFilter },
      {
        $group: {
          _id: '$studentId',
          studentName: { $first: '$studentName' },
          totalSessions: { $sum: 1 },
          presentSessions: {
            $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] }
          },
          lateSessions: {
            $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] }
          }
        }
      },
      {
        $project: {
          studentId: '$_id',
          studentName: 1,
          totalSessions: 1,
          attendanceRate: {
            $multiply: [
              { 
                $divide: [
                  { $add: ['$presentSessions', '$lateSessions'] }, 
                  '$totalSessions'
                ] 
              },
              100
            ]
          }
        }
      },
      { $sort: { attendanceRate: -1 } },
      { $limit: 10 }
    ]);

    // Daily trend (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dailyTrend = await Attendance.aggregate([
      { 
        $match: { 
          timestamp: { $gte: thirtyDaysAgo },
          ...courseFilter
        }
      },
      {
        $group: {
          _id: '$date',
          totalSessions: { $sum: 1 },
          presentSessions: {
            $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] }
          },
          lateSessions: {
            $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      data: {
        overview: {
          totalStudents,
          totalCourses,
          totalMaterials,
          totalAttendanceRecords,
          presentCount,
          lateCount,
          absentCount,
          overallAttendanceRate: totalAttendanceRecords > 0 
            ? (((presentCount + lateCount) / totalAttendanceRecords) * 100).toFixed(1) 
            : '0'
        },
        coursePerformance,
        topStudents,
        dailyTrend,
        attendanceBreakdown: {
          present: presentCount,
          late: lateCount,
          absent: absentCount
        }
      }
    });

  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics data'
    });
  }
});
// Add these routes to your server.js file

// Get all courses (for admin)
app.get('/api/admin/courses', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const courses = await Course.find({ isActive: true }).sort({ courseCode: 1 });
    
    res.json({
      success: true,
      data: courses,
      message: `Found ${courses.length} active courses`
    });

  } catch (error) {
    console.error('Get courses error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch courses'
    });
  }
});

// Create new course
app.post('/api/admin/courses', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { 
      courseCode, 
      courseName, 
      instructor, 
      department, 
      credits, 
      description, 
      schedule, 
      maxCapacity, 
      semester, 
      academicYear 
    } = req.body;

    if (!courseCode || !courseName) {
      return res.status(400).json({
        success: false,
        error: 'Course code and name are required'
      });
    }

    // Check if course already exists
    const existingCourse = await Course.findOne({ 
      courseCode: courseCode.toUpperCase() 
    });

    if (existingCourse) {
      return res.status(400).json({
        success: false,
        error: 'Course with this code already exists'
      });
    }

    const course = new Course({
      courseCode: courseCode.toUpperCase(),
      courseName: courseName.trim(),
      instructor: instructor?.trim(),
      department: department?.trim(),
      credits: parseInt(credits) || 3,
      description: description?.trim(),
      schedule: schedule || { days: [], time: '', room: '' },
      maxCapacity: parseInt(maxCapacity) || 50,
      semester: semester?.trim(),
      academicYear: academicYear?.trim(),
      createdBy: req.user.uniqueId
    });

    const savedCourse = await course.save();

    res.status(201).json({
      success: true,
      message: 'Course created successfully',
      data: savedCourse
    });

  } catch (error) {
    console.error('Create course error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: 'Course code already exists'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to create course'
    });
  }
});

// Get all students (for admin)
app.get('/api/admin/students', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, search, courseCode } = req.query;

    let filter = { role: 'student', isActive: true };

    // Add search functionality
    if (search) {
      filter.$or = [
        { studentName: { $regex: search, $options: 'i' } },
        { studentId: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // Filter by course
    if (courseCode) {
      filter.enrolledCourses = courseCode.toUpperCase();
    }

    const students = await User.find(filter)
      .select('-faceEncodings -password')
      .sort({ studentName: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const totalStudents = await User.countDocuments(filter);

    res.json({
      success: true,
      data: students,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalStudents / limit),
        totalStudents,
        hasMore: page * limit < totalStudents
      }
    });

  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch students'
    });
  }
});

// Delete student
app.delete('/api/admin/students/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const studentId = req.params.id;

    const student = await User.findById(studentId);
    if (!student || student.role !== 'student') {
      return res.status(404).json({
        success: false,
        error: 'Student not found'
      });
    }

    // Remove student from all courses
    if (student.enrolledCourses && student.enrolledCourses.length > 0) {
      await Course.updateMany(
        { courseCode: { $in: student.enrolledCourses } },
        { $pull: { enrolledStudents: student.studentId } }
      );
    }

    // Delete all attendance records
    await Attendance.deleteMany({ studentId: student.studentId });

    // Delete the student
    await User.findByIdAndDelete(studentId);

    res.json({
      success: true,
      message: 'Student deleted successfully'
    });

  } catch (error) {
    console.error('Delete student error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete student'
    });
  }
});

// Get student courses (for student dashboard)
app.get('/api/student/courses', authenticateToken, requireStudent, async (req, res) => {
  try {
    const studentId = req.user.studentId;
    
    const student = await User.findOne({ 
      studentId: studentId, 
      role: 'student',
      isActive: true 
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Student not found'
      });
    }

    const courses = await Course.find({
      courseCode: { $in: student.enrolledCourses },
      isActive: true
    }).select('courseCode courseName instructor schedule');

    res.json({
      success: true,
      data: courses
    });

  } catch (error) {
    console.error('Get student courses error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch courses'
    });
  }
});

// Update existing admin analytics route to handle course filtering
app.get('/api/admin/analytics', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate, courseCode } = req.query;

    let dateFilter = {};
    if (startDate || endDate) {
      dateFilter.timestamp = {};
      if (startDate) dateFilter.timestamp.$gte = new Date(startDate);
      if (endDate) dateFilter.timestamp.$lte = new Date(endDate);
    }

    let courseFilter = {};
    if (courseCode) {
      courseFilter.courseCode = courseCode.toUpperCase();
    }

    const attendanceFilter = { ...dateFilter, ...courseFilter };

    // Basic counts
    const totalStudents = await User.countDocuments({ role: 'student', isActive: true });
    const totalCourses = await Course.countDocuments({ isActive: true });
    const totalMaterials = await Material.countDocuments({ isActive: true });
    const totalAttendanceRecords = await Attendance.countDocuments(attendanceFilter);

    // Attendance statistics
    const attendanceStats = await Attendance.aggregate([
      { $match: attendanceFilter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    let presentCount = 0;
    let lateCount = 0;
    let absentCount = 0;
    
    attendanceStats.forEach(stat => {
      if (stat._id === 'present') presentCount = stat.count;
      if (stat._id === 'late') lateCount = stat.count;
      if (stat._id === 'absent') absentCount = stat.count;
    });

    // Course-wise performance
    const coursePerformance = await Attendance.aggregate([
      { $match: attendanceFilter },
      {
        $group: {
          _id: '$courseCode',
          totalSessions: { $sum: 1 },
          presentSessions: {
            $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] }
          },
          lateSessions: {
            $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] }
          },
          uniqueStudents: { $addToSet: '$studentId' }
        }
      },
      {
        $project: {
          courseCode: '$_id',
          totalSessions: 1,
          presentSessions: 1,
          lateSessions: 1,
          studentCount: { $size: '$uniqueStudents' },
          attendanceRate: {
            $multiply: [
              { 
                $divide: [
                  { $add: ['$presentSessions', '$lateSessions'] }, 
                  '$totalSessions'
                ] 
              },
              100
            ]
          }
        }
      },
      { $sort: { courseCode: 1 } }
    ]);

    // Top performing students
    const topStudents = await Attendance.aggregate([
      { $match: attendanceFilter },
      {
        $group: {
          _id: '$studentId',
          studentName: { $first: '$studentName' },
          totalSessions: { $sum: 1 },
          presentSessions: {
            $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] }
          },
          lateSessions: {
            $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] }
          }
        }
      },
      {
        $project: {
          studentId: '$_id',
          studentName: 1,
          totalSessions: 1,
          attendanceRate: {
            $multiply: [
              { 
                $divide: [
                  { $add: ['$presentSessions', '$lateSessions'] }, 
                  '$totalSessions'
                ] 
              },
              100
            ]
          }
        }
      },
      { $sort: { attendanceRate: -1 } },
      { $limit: 10 }
    ]);

    // Daily trend (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dailyTrend = await Attendance.aggregate([
      { 
        $match: { 
          timestamp: { $gte: thirtyDaysAgo },
          ...courseFilter
        }
      },
      {
        $group: {
          _id: '$date',
          totalSessions: { $sum: 1 },
          presentSessions: {
            $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] }
          },
          lateSessions: {
            $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      data: {
        overview: {
          totalStudents,
          totalCourses,
          totalMaterials,
          totalAttendanceRecords,
          presentCount,
          lateCount,
          absentCount,
          overallAttendanceRate: totalAttendanceRecords > 0 
            ? (((presentCount + lateCount) / totalAttendanceRecords) * 100).toFixed(1) 
            : '0'
        },
        coursePerformance,
        topStudents,
        dailyTrend,
        attendanceBreakdown: {
          present: presentCount,
          late: lateCount,
          absent: absentCount
        }
      }
    });

  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics data'
    });
  }
});

// Add this endpoint to check if student has registered face
app.get('/api/student/face/status', authenticateToken, requireStudent, async (req, res) => {
  try {
    const student = await User.findOne({ 
      studentId: req.user.studentId, 
      role: 'student', 
      isActive: true 
    });
    
    if (!student) {
      return res.status(404).json({ success: false, error: 'Student not found' });
    }
    
    res.json({ 
      success: true, 
      data: { 
        isRegistered: !!student.faceToken 
      } 
    });
  } catch (error) {
    console.error('Face status error:', error);
    res.status(500).json({ success: false, error: 'Failed to check face status' });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File size too large. Maximum size is 50MB.'
      });
    }
  }

  res.status(500).json({
    success: false,
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

// Handle 404 routes
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.originalUrl} not found`
  });
});

// Add this function before the startServer function (around line 2215)
const initializeDefaultData = async () => {
  try {
    console.log('🔄 Initializing default data...');
    
    // Check if admin already exists
    const existingAdmin = await User.findOne({ role: 'admin', uniqueId: 'admin001' });
    if (!existingAdmin) {
      // Create default admin
      const admin = new User({
        role: 'admin',
        adminName: 'System Administrator',
        uniqueId: 'admin001',
        password: 'admin123', // In production, this should be hashed
        email: 'admin@attendance.com',
        phoneNumber: '+1234567890',
        adminLevel: 'super_admin',
        isActive: true
      });
      
      await admin.save();
      console.log('✅ Default admin created (ID: admin001, Password: admin123)');
    } else {
      console.log('ℹ️  Default admin already exists');
    }
    
    // Check if default courses exist
    const existingCourses = await Course.find({ courseCode: { $in: ['ICT651', 'ICT654', 'ICT623', 'ICT624'] } });
    const existingCourseCodes = existingCourses.map(course => course.courseCode);
    
    const defaultCourses = [
      {
        courseCode: 'ICT651',
        courseName: 'Advanced Database Systems',
        instructor: 'Dr. Smith',
        department: 'Computer Science',
        credits: 3,
        description: 'Advanced concepts in database design and management',
        schedule: { days: ['Monday', 'Wednesday'], time: '09:00-10:30', room: 'CS-101' },
        maxCapacity: 50,
        semester: 'Fall 2024',
        academicYear: '2024-2025',
        isActive: true
      },
      {
        courseCode: 'ICT654',
        courseName: 'Machine Learning',
        instructor: 'Dr. Johnson',
        department: 'Computer Science',
        credits: 3,
        description: 'Introduction to machine learning algorithms and applications',
        schedule: { days: ['Tuesday', 'Thursday'], time: '10:00-11:30', room: 'CS-102' },
        maxCapacity: 40,
        semester: 'Fall 2024',
        academicYear: '2024-2025',
        isActive: true
      },
      {
        courseCode: 'ICT623',
        courseName: 'Web Development',
        instructor: 'Prof. Brown',
        department: 'Computer Science',
        credits: 3,
        description: 'Modern web development technologies and frameworks',
        schedule: { days: ['Monday', 'Friday'], time: '14:00-15:30', room: 'CS-103' },
        maxCapacity: 45,
        semester: 'Fall 2024',
        academicYear: '2024-2025',
        isActive: true
      },
      {
        courseCode: 'ICT624',
        courseName: 'Mobile App Development',
        instructor: 'Dr. Wilson',
        department: 'Computer Science',
        credits: 3,
        description: 'Cross-platform mobile application development',
        schedule: { days: ['Wednesday', 'Friday'], time: '16:00-17:30', room: 'CS-104' },
        maxCapacity: 35,
        semester: 'Fall 2024',
        academicYear: '2024-2025',
        isActive: true
      }
    ];
    
    const coursesToCreate = defaultCourses.filter(course => 
      !existingCourseCodes.includes(course.courseCode)
    );
    
    if (coursesToCreate.length > 0) {
      await Course.insertMany(coursesToCreate);
      console.log(`✅ Created ${coursesToCreate.length} default courses`);
    } else {
      console.log('ℹ️  Default courses already exist');
    }
    
    console.log('✅ Default data initialization completed');
    
  } catch (error) {
    console.error('❌ Error initializing default data:', error.message);
    // Don't throw error, just log it so server can still start
  }
};

// Start server
const startServer = async () => {
  try {
    await new Promise((resolve, reject) => {
      mongoose.connection.once('open', resolve);
      mongoose.connection.once('error', reject);
      setTimeout(() => reject(new Error('MongoDB connection timeout')), 50000);
    });

    console.log('✅ Connected to MongoDB successfully');
    console.log(`   📍 Database: ${MONGODB_URI}`);
    
    await initializeDefaultData();
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log('\n🚀 Professional Attendance System Server Started!');
      console.log(`   🌐 Server: http://localhost:${PORT}`);
      console.log(`   🏥 Health: http://localhost:${PORT}/api/health`);
      console.log(`   📱 Mobile: http://192.168.1.2:${PORT}/api`);
      console.log('\n📋 Default Login Credentials:');
      console.log('   👤 Admin - ID: admin001, Password: admin123');
      console.log('\n📚 Features Available:');
      console.log('   • Student & Course Management');
      console.log('   • Face Recognition Attendance');
      console.log('   • Material Upload & Management');
      console.log('   • Advanced Analytics & Reports');
      console.log('   • Real-time Notifications');
      console.log('\n🛑 Press Ctrl+C to stop the server\n');
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down server gracefully...');
  
  try {
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

startServer();