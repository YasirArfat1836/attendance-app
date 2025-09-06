# Attendance App

A professional face recognition-based attendance management system built with React Native and Node.js.

## 🚀 Features

### For Students
- **Face Recognition Login** - Quick and secure login using Student ID
- **Face Registration** - Easy face capture and registration process
- **Attendance Marking** - Mark attendance using face recognition technology
- **Attendance History** - View detailed attendance records and statistics
- **Course Materials** - Access course materials and resources
- **Real-time Dashboard** - View attendance overview and course performance

### For Teachers/Admins
- **Student Management** - Create, view, and manage student accounts
- **Course Management** - Create and manage courses with schedules
- **Material Upload** - Upload and organize course materials
- **Analytics & Reports** - Comprehensive attendance analytics and insights
- **Real-time Notifications** - System alerts and notifications
- **Advanced Dashboard** - Professional admin dashboard with key metrics

## 🛠️ Technology Stack

### Frontend
- **React Native** - Cross-platform mobile development
- **Expo** - Development platform and tools
- **React Navigation** - Navigation library
- **AsyncStorage** - Local data persistence
- **Expo Camera** - Camera functionality
- **Expo ImagePicker** - Image selection and capture

### Backend
- **Node.js** - Server runtime
- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - MongoDB object modeling
- **JWT** - Authentication tokens
- **Multer** - File upload handling
- **Axios** - HTTP client

### Face Recognition
- **Face++ API** - Professional face recognition service
- **Face Detection** - Real-time face detection
- **Face Comparison** - Identity verification
- **Liveness Detection** - Anti-spoofing protection

## 📱 Screenshots

### Student Interface
- Clean and intuitive dashboard
- Professional face registration flow
- Real-time attendance marking with face matching animation
- Comprehensive attendance history

### Admin Interface
- Professional admin dashboard
- Student and course management
- Advanced analytics and reporting
- Material management system

## 🚀 Getting Started

### Prerequisites
- Node.js (v14 or higher)
- MongoDB
- Expo CLI
- Face++ API credentials

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/attendance-app.git
   cd attendance-app
   ```

2. **Install dependencies**
   ```bash
   # Install server dependencies
   npm install
   
   # Install client dependencies
   cd client
   npm install
   ```

3. **Environment Setup**
   ```bash
   # Create .env file in root directory
   touch .env
   ```
   
   Add the following environment variables:
   ```env
   MONGODB_URI=mongodb://127.0.0.1:27017/attendance_professional
   JWT_SECRET=your-jwt-secret-key
   FACEPP_API_KEY=your-facepp-api-key
   FACEPP_API_SECRET=your-facepp-api-secret
   PORT=3000
   ```

4. **Start the application**
   ```bash
   # Start the server
   npm start
   
   # In another terminal, start the mobile app
   cd client
   expo start
   ```

## 📋 Default Login Credentials

### Admin Account
- **ID**: admin001
- **Password**: admin123

### Student Account
- **Student ID**: [Created by admin]

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/admin/login` - Admin login
- `POST /api/auth/admin/register` - Admin registration
- `POST /api/auth/student/login` - Student login

### Student Management
- `GET /api/admin/students` - Get all students
- `POST /api/admin/students` - Create new student
- `DELETE /api/admin/students/:id` - Delete student

### Face Recognition
- `POST /api/student/face/register-image` - Register face
- `GET /api/student/face/status` - Check face registration status
- `POST /api/student/attendance-image` - Mark attendance with face recognition

### Course Management
- `GET /api/admin/courses` - Get all courses
- `POST /api/admin/courses` - Create new course
- `GET /api/student/courses` - Get student's enrolled courses

### Materials
- `GET /api/materials/:courseCode` - Get course materials
- `POST /api/admin/materials` - Upload material
- `GET /api/student/materials` - Get student materials

### Analytics
- `GET /api/admin/analytics` - Get attendance analytics
- `GET /api/student/dashboard` - Get student dashboard data

## 🎯 Usage Guide

### For Students

1. **Login**
   - Enter your Student ID
   - Tap "Sign In"

2. **Face Registration** (First time only)
   - Tap "Register Face Now" on dashboard
   - Follow the camera instructions
   - Capture your photo
   - Review and confirm registration

3. **Mark Attendance**
   - Select your course
   - Tap "Start Face Recognition"
   - Position your face in the frame
   - Wait for face matching and confirmation

4. **View History**
   - Access attendance history
   - Filter by status (present, late, absent)
   - View detailed records

### For Teachers/Admins

1. **Login**
   - Enter Admin ID and password
   - Access admin dashboard

2. **Manage Students**
   - Create new student accounts
   - View and edit student information
   - Delete student accounts

3. **Manage Courses**
   - Create new courses
   - Set schedules and capacity
   - Assign students to courses

4. **Upload Materials**
   - Upload course materials
   - Organize by course
   - Set publication dates

5. **View Reports**
   - Access attendance analytics
   - Generate reports
   - Monitor system performance

## 🔒 Security Features

- **JWT Authentication** - Secure token-based authentication
- **Face Recognition** - Biometric identity verification
- **Liveness Detection** - Prevents photo/video spoofing
- **Role-based Access** - Different permissions for students and admins
- **Data Encryption** - Secure data transmission
- **Input Validation** - Comprehensive input sanitization

## 📊 Database Schema

### Users Collection
```javascript
{
  role: String, // 'admin' or 'student'
  studentName: String,
  studentId: String,
  faceToken: String, // Face++ token
  enrolledCourses: [String],
  // ... other fields
}
```

### Attendance Collection
```javascript
{
  studentId: String,
  courseCode: String,
  date: String,
  status: String, // 'present', 'late', 'absent'
  confidenceScore: Number,
  timestamp: Date,
  // ... other fields
}
```

### Courses Collection
```javascript
{
  courseCode: String,
  courseName: String,
  instructor: String,
  schedule: Object,
  enrolledStudents: [String],
  // ... other fields
}
```

## 🚀 Deployment

### Server Deployment
1. Set up MongoDB Atlas or local MongoDB
2. Configure environment variables
3. Deploy to Heroku, AWS, or your preferred platform
4. Update API_BASE_URL in client

### Mobile App Deployment
1. Build for production
2. Deploy to App Store/Google Play
3. Configure deep linking if needed

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support, email support@attendance-app.com or create an issue in the repository.

## 🙏 Acknowledgments

- Face++ for providing excellent face recognition API
- React Native community for amazing documentation
- Expo team for the development platform
- All contributors who helped improve this project

---

**Made with ❤️ for educational institutions**
