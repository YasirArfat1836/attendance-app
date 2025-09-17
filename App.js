import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
  Dimensions,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  FlatList,
  Modal,
  Switch,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { Picker } from '@react-native-picker/picker';
import * as FileSystem from 'expo-file-system';

const { width, height } = Dimensions.get('window');
const Stack = createStackNavigator();

// API Configuration
const API_BASE_URL = 'http://10.53.60.118:3000/api';

// Enhanced API Helper Functions
const apiCall = async (endpoint, options = {}) => {
  try {
    const token = await AsyncStorage.getItem('userToken');
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers,
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.message || `HTTP ${response.status}`);
    }

    return data;
  } catch (error) {
    if (error.message.includes('Network request failed')) {
      throw new Error('Connection failed. Please check your network and server.');
    }
    throw error;
  }
};

// Utility functions
const showSuccess = (message) => Alert.alert('Success', message);
const showError = (message) => Alert.alert('Error', message);

// Validation helpers
const isValidEmail = (email) => {
  if (!email) return true; // optional in some forms
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
  return emailRegex.test(String(email).trim());
};

const isValidPhone = (phone) => {
  if (!phone) return true; // optional in some forms
  const digits = String(phone).replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
};

const isValidPassword = (password) => String(password || '').length >= 8;

const isValidAcademicYear = (text) => {
  if (!text) return true;
  const match = /^(\d{4})-(\d{4})$/.exec(String(text));
  if (!match) return false;
  const start = parseInt(match[1], 10);
  const end = parseInt(match[2], 10);
  return end === start + 1;
};

const pad2 = (n) => String(n).padStart(2, '0');
const formatDate = (y, m, d) => `${y}-${pad2(m)}-${pad2(d)}`;
const parseDateString = (value) => {
  try {
    const [y, m, d] = String(value).split('-').map((v) => parseInt(v, 10));
    if (!y || !m || !d) throw new Error('invalid');
    return { year: y, month: m, day: d };
  } catch {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
  }
};

// Professional Loading Screen
const LoadingScreen = ({ message = 'Loading...' }) => (
  <SafeAreaView style={styles.container}>
    <StatusBar backgroundColor="#1976D2" barStyle="light-content" />
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#1976D2" />
      <Text style={styles.loadingText}>{message}</Text>
    </View>
  </SafeAreaView>
);

// Registration Screen
const RegistrationScreen = ({ navigation }) => {
  const [userType, setUserType] = useState('admin');
  const [adminData, setAdminData] = useState({
    adminName: '',
    uniqueId: '',
    password: '',
    email: '',
    phoneNumber: '',
    adminLevel: 'admin'
  });
  const [studentData, setStudentData] = useState({
    studentName: '',
    studentId: '',
    dateOfBirth: '',
    email: '',
    phoneNumber: '',
    address: '',
    academicYear: '',
    semester: '',
    enrolledCourses: [],
    emergencyContact: {
      name: '',
      phone: '',
      relationship: ''
    }
  });
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [faceImage, setFaceImage] = useState(null);
  const [dobPickerOpen, setDobPickerOpen] = useState(false);
  const [dobYear, setDobYear] = useState(new Date().getFullYear());
  const [dobMonth, setDobMonth] = useState(new Date().getMonth() + 1);
  const [dobDay, setDobDay] = useState(new Date().getDate());

  useEffect(() => {
    if (userType === 'student') {
      loadCourses();
    }
  }, [userType]);

  const loadCourses = async () => {
    try {
      // For registration, we'll use a simple course list
      const defaultCourses = [
        { courseCode: 'ICT651', courseName: 'Advanced Database Systems' },
        { courseCode: 'ICT654', courseName: 'Machine Learning' },
        { courseCode: 'ICT623', courseName: 'Web Development' },
        { courseCode: 'ICT624', courseName: 'Mobile App Development' }
      ];
      setCourses(defaultCourses);
    } catch (error) {
      console.error('Failed to load courses:', error);
    }
  };

  const handleAdminRegistration = async () => {
    if (!adminData.adminName.trim() || !adminData.uniqueId.trim() || !adminData.password.trim()) {
      showError('Please fill all required fields');
      return;
    }

    if (!isValidPassword(adminData.password)) {
      showError('Password must be at least 8 characters long');
      return;
    }
    if (!isValidEmail(adminData.email)) {
      showError('Please enter a valid email address');
      return;
    }
    if (!isValidPhone(adminData.phoneNumber)) {
      showError('Please enter a valid phone number');
      return;
    }

    setLoading(true);
    try {
      const response = await apiCall('/auth/admin/register', {
        method: 'POST',
        body: JSON.stringify(adminData),
      });

      if (response.success) {
        showSuccess('Admin registered successfully!');
        navigation.navigate('Login');
      }
    } catch (error) {
      showError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStudentRegistration = async () => {
    if (!studentData.studentName.trim() || !studentData.studentId.trim() || !studentData.dateOfBirth) {
      showError('Please fill all required fields');
      return;
    }

    if (studentData.email && !isValidEmail(studentData.email)) {
      showError('Please enter a valid student email address');
      return;
    }
    if (studentData.phoneNumber && !isValidPhone(studentData.phoneNumber)) {
      showError('Please enter a valid phone number');
      return;
    }
    if (studentData.academicYear && !isValidAcademicYear(studentData.academicYear)) {
      showError('Academic Year must be in format YYYY-YYYY (consecutive years)');
      return;
    }

    setLoading(true);
    try {
      const response = await apiCall('/admin/students', {
        method: 'POST',
        body: JSON.stringify({
          ...studentData,
          faceImage: faceImage
        }),
      });

      if (response.success) {
        showSuccess('Student registered successfully!');
        navigation.navigate('Login');
      }
    } catch (error) {
      showError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const takeFacePhoto = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        showError('Camera permission is required');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: false
      });

      if (!result.canceled) {
        setFaceImage(result.assets[0].uri);
        // Remove the API call - face registration will happen after login
      }
    } catch (error) {
      showError('Failed to capture photo');
    }
  };

  const toggleCourseSelection = (courseCode) => {
    setStudentData(prev => ({
      ...prev,
      enrolledCourses: prev.enrolledCourses.includes(courseCode)
        ? prev.enrolledCourses.filter(code => code !== courseCode)
        : [...prev.enrolledCourses, courseCode]
    }));
  };

  const openDobPicker = () => {
    const { year, month, day } = parseDateString(studentData.dateOfBirth);
    setDobYear(year);
    setDobMonth(month);
    setDobDay(day);
    setDobPickerOpen(true);
  };

  const confirmDobPicker = () => {
    setStudentData({ ...studentData, dateOfBirth: formatDate(dobYear, dobMonth, dobDay) });
    setDobPickerOpen(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#1976D2" barStyle="light-content" />
      
      <View style={styles.registrationHeader}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.registrationTitle}>Create Account</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.userTypeContainer}>
          <TouchableOpacity
            style={[styles.userTypeButton, userType === 'admin' && styles.activeUserType]}
            onPress={() => setUserType('admin')}
          >
            <Text style={[styles.userTypeText, userType === 'admin' && styles.activeUserTypeText]}>
              Admin/Teacher
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.userTypeButton, userType === 'student' && styles.activeUserType]}
            onPress={() => setUserType('student')}
          >
            <Text style={[styles.userTypeText, userType === 'student' && styles.activeUserTypeText]}>
              Student
            </Text>
          </TouchableOpacity>
        </View>

        {userType === 'admin' ? (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Admin Registration</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Admin Name *</Text>
              <TextInput
                style={styles.modernInput}
                placeholder="Enter full name"
                value={adminData.adminName}
                onChangeText={(text) => setAdminData({...adminData, adminName: text})}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Unique ID *</Text>
              <TextInput
                style={styles.modernInput}
                placeholder="Enter unique ID"
                value={adminData.uniqueId}
                onChangeText={(text) => setAdminData({...adminData, uniqueId: text})}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Password *</Text>
              <TextInput
                style={styles.modernInput}
                placeholder="Enter password (min 8 chars)"
                secureTextEntry
                value={adminData.password}
                onChangeText={(text) => setAdminData({...adminData, password: text})}
              />
              {!!adminData.password && !isValidPassword(adminData.password) && (
                <Text style={styles.validationText}>Password must be at least 8 characters</Text>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email</Text>
              <TextInput
                style={styles.modernInput}
                placeholder="Enter email address"
                keyboardType="email-address"
                value={adminData.email}
                onChangeText={(text) => setAdminData({...adminData, email: text})}
                autoCapitalize="none"
              />
              {!!adminData.email && !isValidEmail(adminData.email) && (
                <Text style={styles.validationText}>Enter a valid email address</Text>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Phone Number</Text>
              <TextInput
                style={styles.modernInput}
                placeholder="Enter phone number"
                keyboardType="phone-pad"
                value={adminData.phoneNumber}
                onChangeText={(text) => setAdminData({...adminData, phoneNumber: text})}
              />
              {!!adminData.phoneNumber && !isValidPhone(adminData.phoneNumber) && (
                <Text style={styles.validationText}>Enter a valid phone number</Text>
              )}
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.disabledButton]}
              onPress={handleAdminRegistration}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Register Admin</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Student Registration</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Student Name *</Text>
              <TextInput
                style={styles.modernInput}
                placeholder="Enter full name"
                value={studentData.studentName}
                onChangeText={(text) => setStudentData({...studentData, studentName: text})}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Student ID *</Text>
              <TextInput
                style={styles.modernInput}
                placeholder="Enter student ID"
                value={studentData.studentId}
                onChangeText={(text) => setStudentData({...studentData, studentId: text})}
                autoCapitalize="characters"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Date of Birth *</Text>
              <TouchableOpacity onPress={openDobPicker}>
                <View style={[styles.modernInput, { justifyContent: 'center' }]}>
                  <Text style={{ color: studentData.dateOfBirth ? '#212529' : '#6c757d' }}>
                    {studentData.dateOfBirth || 'YYYY-MM-DD'}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email</Text>
              <TextInput
                style={styles.modernInput}
                placeholder="Enter email address"
                keyboardType="email-address"
                value={studentData.email}
                onChangeText={(text) => setStudentData({...studentData, email: text})}
                autoCapitalize="none"
              />
              {!!studentData.email && !isValidEmail(studentData.email) && (
                <Text style={styles.validationText}>Enter a valid email address</Text>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Academic Year</Text>
              <TextInput
                style={styles.modernInput}
                placeholder="e.g., 2024-2025"
                value={studentData.academicYear}
                onChangeText={(text) => setStudentData({...studentData, academicYear: text})}
              />
              {!!studentData.academicYear && !isValidAcademicYear(studentData.academicYear) && (
                <Text style={styles.validationText}>Format must be YYYY-YYYY (consecutive years)</Text>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Semester</Text>
              <TextInput
                style={styles.modernInput}
                placeholder="e.g., Fall 2024"
                value={studentData.semester}
                onChangeText={(text) => setStudentData({...studentData, semester: text})}
              />
            </View>

            {courses.length > 0 && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Enrolled Courses</Text>
                <View style={styles.courseSelectionGrid}>
                  {courses.map(course => (
                    <TouchableOpacity
                      key={course.courseCode}
                      style={[
                        styles.courseChip,
                        studentData.enrolledCourses.includes(course.courseCode) && styles.selectedCourseChip
                      ]}
                      onPress={() => toggleCourseSelection(course.courseCode)}
                    >
                      <Text style={[
                        styles.courseChipText,
                        studentData.enrolledCourses.includes(course.courseCode) && styles.selectedCourseChipText
                      ]}>
                        {course.courseCode}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.disabledButton]}
              onPress={handleStudentRegistration}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Register Student</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.linkText}>Already have an account? Sign In</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* DOB Picker Modal */}
      <Modal
        visible={dobPickerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setDobPickerOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 12, textAlign: 'center' }}>Select Date of Birth</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={{ marginBottom: 6, fontWeight: '600' }}>Year</Text>
                <Picker
                  selectedValue={dobYear}
                  onValueChange={(v) => setDobYear(v)}
                >
                  {Array.from({ length: 80 }).map((_, idx) => {
                    const y = new Date().getFullYear() - idx;
                    return <Picker.Item key={y} label={String(y)} value={y} />;
                  })}
                </Picker>
              </View>
              <View style={{ width: 110, marginRight: 8 }}>
                <Text style={{ marginBottom: 6, fontWeight: '600' }}>Month</Text>
                <Picker
                  selectedValue={dobMonth}
                  onValueChange={(v) => setDobMonth(v)}
                >
                  {Array.from({ length: 12 }).map((_, idx) => {
                    const m = idx + 1;
                    return <Picker.Item key={m} label={pad2(m)} value={m} />;
                  })}
                </Picker>
              </View>
              <View style={{ width: 110 }}>
                <Text style={{ marginBottom: 6, fontWeight: '600' }}>Day</Text>
                <Picker
                  selectedValue={dobDay}
                  onValueChange={(v) => setDobDay(v)}
                >
                  {Array.from({ length: 31 }).map((_, idx) => {
                    const d = idx + 1;
                    return <Picker.Item key={d} label={pad2(d)} value={d} />;
                  })}
                </Picker>
              </View>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 }}>
              <TouchableOpacity onPress={() => setDobPickerOpen(false)} style={{ padding: 12, marginRight: 8 }}>
                <Text style={{ color: '#666', fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={confirmDobPicker} style={{ padding: 12 }}>
                <Text style={{ color: '#1976D2', fontWeight: '700' }}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

// Enhanced Login Screen - Teacher/Student
const LoginScreen = ({ navigation }) => {
  const [userType, setUserType] = useState('teacher');
  const [teacherData, setTeacherData] = useState({ uniqueId: '', password: '' });
  const [studentData, setStudentData] = useState({ studentId: '' });
  const [loading, setLoading] = useState(false);

  const handleTeacherLogin = async () => {
    if (!teacherData.uniqueId.trim() || !teacherData.password.trim()) {
      showError('Please fill all fields');
      return;
    }

    if (!isValidPassword(teacherData.password)) {
      showError('Password must be at least 8 characters long');
      return;
    }

    setLoading(true);
    try {
      const response = await apiCall('/auth/admin/login', {
        method: 'POST',
        body: JSON.stringify({
          uniqueId: teacherData.uniqueId.trim(),
          password: teacherData.password
        }),
      });

      if (response.success) {
        await AsyncStorage.setItem('userToken', response.data.token);
        await AsyncStorage.setItem('userRole', 'admin');
        await AsyncStorage.setItem('userInfo', JSON.stringify(response.data.user));

        showSuccess(`Welcome back, ${response.data.user.adminName}!`);
        navigation.replace('AdminDashboard');
      }
    } catch (error) {
      showError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStudentLogin = async () => {
    if (!studentData.studentId.trim()) {
      showError('Please enter student ID');
      return;
    }

    setLoading(true);
    try {
      const response = await apiCall('/auth/student/login', {
        method: 'POST',
        body: JSON.stringify({
          studentId: studentData.studentId.trim()
        }),
      });

      if (response.success) {
        await AsyncStorage.setItem('userToken', response.data.token);
        await AsyncStorage.setItem('userRole', 'student');
        await AsyncStorage.setItem('userInfo', JSON.stringify(response.data.user));

        showSuccess(`Welcome back, ${response.data.user.studentName}!`);
        navigation.replace('StudentDashboard');
      }
    } catch (error) {
      showError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#1976D2" barStyle="light-content" />
      <View style={styles.loginHeader}>
        <Image
          source={require('./assets/sistc-logo.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />
        <Text style={styles.appTitle}>AttendancePro</Text>
        <Text style={styles.appSubtitle}>Smart Face Recognition System</Text>
      </View>

      <ScrollView contentContainerStyle={styles.loginContainer}>
        <View style={styles.loginCard}>
          <View style={styles.userTypeContainer}>
            <TouchableOpacity
              style={[styles.userTypeButton, userType === 'teacher' && styles.activeUserType]}
              onPress={() => setUserType('teacher')}
            >
              <Text style={[styles.userTypeText, userType === 'teacher' && styles.activeUserTypeText]}>
                Teacher
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.userTypeButton, userType === 'student' && styles.activeUserType]}
              onPress={() => setUserType('student')}
            >
              <Text style={[styles.userTypeText, userType === 'student' && styles.activeUserTypeText]}>
                Student
              </Text>
            </TouchableOpacity>
          </View>

          {userType === 'teacher' ? (
            <View style={styles.formSection}>
              <Text style={styles.formTitle}>Teacher Login</Text>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Teacher ID</Text>
                <TextInput
                  style={styles.modernInput}
                  placeholder="Enter your teacher ID"
                  value={teacherData.uniqueId}
                  onChangeText={(text) => setTeacherData({ ...teacherData, uniqueId: text })}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Password</Text>
                <TextInput
                  style={styles.modernInput}
                  placeholder="Enter your password"
                  secureTextEntry
                  value={teacherData.password}
                  onChangeText={(text) => setTeacherData({ ...teacherData, password: text })}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <TouchableOpacity
                style={[styles.primaryButton, loading && styles.disabledButton]}
                onPress={handleTeacherLogin}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.primaryButtonText}>Sign In</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.linkButton}
                onPress={() => Alert.alert('Contact Admin', 'Please contact your administrator to reset your password.')}
              >
                <Text style={styles.linkText}>Forgot your password?</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.formSection}>
              <Text style={styles.formTitle}>Student Login</Text>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Student ID</Text>
                <TextInput
                  style={styles.modernInput}
                  placeholder="Enter your student ID"
                  value={studentData.studentId}
                  onChangeText={(text) => setStudentData({ studentId: text })}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
              </View>

              <TouchableOpacity
                style={[styles.primaryButton, loading && styles.disabledButton]}
                onPress={handleStudentLogin}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.primaryButtonText}>Sign In</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.linkButton}
                onPress={() => Alert.alert('Student Help', 'Contact your teacher or administrator if you need help with your Student ID.')}
              >
                <Text style={styles.linkText}>Need help with your Student ID?</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.helpSection}>
            <Text style={styles.helpTitle}>Need Account Access?</Text>
            <Text style={styles.helpText}>Contact your institution's administrator</Text>
            <Text style={styles.helpText}>for login credentials and account setup.</Text>
          </View>
        </View>
        
        <TouchableOpacity
          style={styles.registerLink}
          onPress={() => navigation.navigate('Registration')}
        >
          <Text style={styles.registerLinkText}>Don't have an account? Register</Text>
        </TouchableOpacity>
        
        <View style={styles.footerContainer}>
          <Text style={styles.footerText}>Incorporation with Dr Mohammad Reza Jabbarpour</Text>
          <Text style={styles.versionText}>Version 2.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// Professional Admin Dashboard
const AdminDashboardScreen = ({ navigation }) => {
  const [userInfo, setUserInfo] = useState({});
  const [analytics, setAnalytics] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const info = await AsyncStorage.getItem('userInfo');
      if (info) {
        setUserInfo(JSON.parse(info));
      }

      const response = await apiCall('/admin/analytics');
      if (response.success) {
        setAnalytics(response.data);
      }
    } catch (error) {
      console.error('Dashboard load error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.multiRemove(['userToken', 'userRole', 'userInfo']);
            navigation.replace('Login');
          }
        }
      ]
    );
  };

  if (loading) return <LoadingScreen message="Loading dashboard..." />;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#1976D2" barStyle="light-content" />
      
      <View style={styles.professionalHeader}>
        <View>
          <Text style={styles.headerWelcome}>Good day,</Text>
          <Text style={styles.headerName}>{userInfo.adminName || 'Teacher'}</Text>
          <Text style={styles.headerRole}>{userInfo.adminLevel || 'Administrator'}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutIconButton}>
          <Text style={styles.logoutIcon}>⚙</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.dashboardContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Analytics Overview */}
        <View style={styles.analyticsSection}>
          <Text style={styles.sectionTitle}>System Overview</Text>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{analytics.overview?.totalStudents || 0}</Text>
              <Text style={styles.statLabel}>Total Students</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{analytics.overview?.totalCourses || 0}</Text>
              <Text style={styles.statLabel}>Active Courses</Text>
            </View>
          </View>
          
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{analytics.overview?.overallAttendanceRate || 0}%</Text>
              <Text style={styles.statLabel}>Attendance Rate</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{analytics.overview?.totalMaterials || 0}</Text>
              <Text style={styles.statLabel}>Course Materials</Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActionsSection}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionGrid}>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => navigation.navigate('CreateStudent')}
            >
              <View style={styles.actionIcon}>
                <Text style={styles.actionEmoji}>👤</Text>
              </View>
              <Text style={styles.actionTitle}>Add Student</Text>
              <Text style={styles.actionSubtitle}>Register new student</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => navigation.navigate('ViewStudents')}
            >
              <View style={styles.actionIcon}>
                <Text style={styles.actionEmoji}>👥</Text>
              </View>
              <Text style={styles.actionTitle}>Manage Students</Text>
              <Text style={styles.actionSubtitle}>View & edit students</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => navigation.navigate('MaterialManagement')}
            >
              <View style={styles.actionIcon}>
                <Text style={styles.actionEmoji}>📚</Text>
              </View>
              <Text style={styles.actionTitle}>Course Materials</Text>
              <Text style={styles.actionSubtitle}>Upload & manage</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => navigation.navigate('AttendanceReports')}
            >
              <View style={styles.actionIcon}>
                <Text style={styles.actionEmoji}>📊</Text>
              </View>
              <Text style={styles.actionTitle}>Reports</Text>
              <Text style={styles.actionSubtitle}>Analytics & insights</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => navigation.navigate('CreateCourse')}
            >
              <View style={styles.actionIcon}>
                <Text style={styles.actionEmoji}>🎓</Text>
              </View>
              <Text style={styles.actionTitle}>New Course</Text>
              <Text style={styles.actionSubtitle}>Create course</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => navigation.navigate('Notifications')}
            >
              <View style={styles.actionIcon}>
                <Text style={styles.actionEmoji}>🔔</Text>
              </View>
              <Text style={styles.actionTitle}>Notifications</Text>
              <Text style={styles.actionSubtitle}>System alerts</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.recentSection}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          {analytics.dailyTrend?.slice(-5).map((day, index) => (
            <View key={index} style={styles.activityItem}>
              <View style={styles.activityDate}>
                <Text style={styles.activityDay}>{new Date(day._id).getDate()}</Text>
                <Text style={styles.activityMonth}>
                  {new Date(day._id).toLocaleDateString('en', { month: 'short' })}
                </Text>
              </View>
              <View style={styles.activityDetails}>
                <Text style={styles.activityTitle}>
                  {day.totalSessions} attendance records
                </Text>
                <Text style={styles.activitySubtitle}>
                  {day.presentSessions + day.lateSessions} present, {day.totalSessions - day.presentSessions - day.lateSessions} absent
                </Text>
              </View>
              <View style={styles.activityStatus}>
                <Text style={[styles.statusBadge, styles.successBadge]}>
                  {((day.presentSessions + day.lateSessions) / day.totalSessions * 100).toFixed(0)}%
                </Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// Create Student Screen
const CreateStudentScreen = ({ navigation }) => {
  const [studentData, setStudentData] = useState({
    studentName: '',
    studentId: '',
    dateOfBirth: '',
    email: '',
    phoneNumber: '',
    address: '',
    academicYear: '',
    semester: '',
    enrolledCourses: [],
    emergencyContact: {
      name: '',
      phone: '',
      relationship: ''
    }
  });
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadCourses();
  }, []);

  const loadCourses = async () => {
    try {
      const response = await apiCall('/admin/courses');
      if (response.success) {
        setCourses(response.data || []);
      }
    } catch (error) {
      console.error('Failed to load courses:', error);
    }
  };

  const toggleCourseSelection = (courseCode) => {
    setStudentData(prev => ({
      ...prev,
      enrolledCourses: prev.enrolledCourses.includes(courseCode)
        ? prev.enrolledCourses.filter(code => code !== courseCode)
        : [...prev.enrolledCourses, courseCode]
    }));
  };

  const handleCreateStudent = async () => {
    if (!studentData.studentName.trim() || !studentData.studentId.trim() || !studentData.dateOfBirth) {
      showError('Please fill all required fields');
      return;
    }

    if (studentData.email && !isValidEmail(studentData.email)) {
      showError('Please enter a valid student email address');
      return;
    }
    if (studentData.phoneNumber && !isValidPhone(studentData.phoneNumber)) {
      showError('Please enter a valid phone number');
      return;
    }
    if (studentData.academicYear && !isValidAcademicYear(studentData.academicYear)) {
      showError('Academic Year must be in format YYYY-YYYY (consecutive years)');
      return;
    }

    setLoading(true);
    try {
      const response = await apiCall('/admin/students', {
        method: 'POST',
        body: JSON.stringify({
          ...studentData,
        }),
      });

      if (response.success) {
        showSuccess('Student created successfully! Student can now login and register their face.');
        navigation.goBack();
      }
    } catch (error) {
      showError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.createStudentContainer}>
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Create New Student</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Student Name *</Text>
            <TextInput
              style={styles.modernInput}
              placeholder="Enter full name"
              value={studentData.studentName}
              onChangeText={(text) => setStudentData({...studentData, studentName: text})}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Student ID *</Text>
            <TextInput
              style={styles.modernInput}
              placeholder="Enter student ID"
              value={studentData.studentId}
              onChangeText={(text) => setStudentData({...studentData, studentId: text})}
              autoCapitalize="characters"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Date of Birth *</Text>
            <TouchableOpacity onPress={openDobPicker}>
              <View style={[styles.modernInput, { justifyContent: 'center' }]}>
                <Text style={{ color: studentData.dateOfBirth ? '#212529' : '#6c757d' }}>
                  {studentData.dateOfBirth || 'YYYY-MM-DD'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={styles.modernInput}
              placeholder="Enter email address"
              keyboardType="email-address"
              value={studentData.email}
              onChangeText={(text) => setStudentData({...studentData, email: text})}
              autoCapitalize="none"
            />
            {!!studentData.email && !isValidEmail(studentData.email) && (
              <Text style={styles.validationText}>Enter a valid email address</Text>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Phone Number</Text>
            <TextInput
              style={styles.modernInput}
              placeholder="Enter phone number"
              keyboardType="phone-pad"
              value={studentData.phoneNumber}
              onChangeText={(text) => setStudentData({...studentData, phoneNumber: text})}
            />
            {!!studentData.phoneNumber && !isValidPhone(studentData.phoneNumber) && (
              <Text style={styles.validationText}>Enter a valid phone number</Text>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Academic Year</Text>
            <TextInput
              style={styles.modernInput}
              placeholder="e.g., 2024-2025"
              value={studentData.academicYear}
              onChangeText={(text) => setStudentData({...studentData, academicYear: text})}
            />
            {!!studentData.academicYear && !isValidAcademicYear(studentData.academicYear) && (
              <Text style={styles.validationText}>Format must be YYYY-YYYY (consecutive years)</Text>
            )}
          </View>

          {courses.length > 0 && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Enrolled Courses</Text>
              <View style={styles.courseSelectionGrid}>
                {courses.map(course => (
                  <TouchableOpacity
                    key={course.courseCode}
                    style={[
                      styles.courseChip,
                      studentData.enrolledCourses.includes(course.courseCode) && styles.selectedCourseChip
                    ]}
                    onPress={() => toggleCourseSelection(course.courseCode)}
                  >
                    <Text style={[
                      styles.courseChipText,
                      studentData.enrolledCourses.includes(course.courseCode) && styles.selectedCourseChipText
                    ]}>
                      {course.courseCode}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.disabledButton]}
            onPress={handleCreateStudent}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>Create Student</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// View Students Screen
const ViewStudentsScreen = ({ navigation }) => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    setLoading(true);
    try {
      const response = await apiCall('/admin/students');
      if (response.success) {
        setStudents(response.data || []);
      }
    } catch (error) {
      showError('Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  const deleteStudent = (studentId) => {
    Alert.alert(
      'Delete Student',
      'Are you sure you want to delete this student? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await apiCall(`/admin/students/${studentId}`, {
                method: 'DELETE'
              });
              if (response.success) {
                showSuccess('Student deleted successfully');
                loadStudents();
              }
            } catch (error) {
              showError('Failed to delete student');
            }
          }
        }
      ]
    );
  };

  const filteredStudents = students.filter(student =>
    student.studentName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    student.studentId?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search students..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <FlatList
        data={filteredStudents}
        keyExtractor={(item) => item._id}
        refreshing={loading}
        onRefresh={loadStudents}
        renderItem={({ item }) => (
          <View style={styles.studentItem}>
            <View style={styles.studentInfo}>
              <Text style={styles.studentName}>{item.studentName}</Text>
              <Text style={styles.studentIdText}>ID: {item.studentId}</Text>
              <Text style={styles.studentCourses}>
                Courses: {item.enrolledCourses?.join(', ') || 'None'}
              </Text>
            </View>
            <View style={styles.studentActions}>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => deleteStudent(item._id)}
              >
                <Text style={styles.deleteButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No students found</Text>
            <Text style={styles.emptySubtext}>Create your first student to get started</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

// Create Course Screen
const CreateCourseScreen = ({ navigation }) => {
  const [courseData, setCourseData] = useState({
    courseCode: '',
    courseName: '',
    instructor: '',
    department: '',
    credits: '3',
    description: '',
    schedule: {
      days: [],
      time: '',
      room: ''
    },
    maxCapacity: '50',
    semester: '',
    academicYear: ''
  });
  const [loading, setLoading] = useState(false);

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const toggleDay = (day) => {
    setCourseData(prev => ({
      ...prev,
      schedule: {
        ...prev.schedule,
        days: prev.schedule.days.includes(day)
          ? prev.schedule.days.filter(d => d !== day)
          : [...prev.schedule.days, day]
      }
    }));
  };

  const handleCreateCourse = async () => {
    if (!courseData.courseCode.trim() || !courseData.courseName.trim()) {
      showError('Course code and name are required');
      return;
    }

    setLoading(true);
    try {
      const response = await apiCall('/admin/courses', {
        method: 'POST',
        body: JSON.stringify(courseData),
      });

      if (response.success) {
        showSuccess('Course created successfully!');
        navigation.goBack();
      }
    } catch (error) {
      showError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.createCourseContainer}>
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Create New Course</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Course Code *</Text>
            <TextInput
              style={styles.modernInput}
              placeholder="e.g., ICT651"
              value={courseData.courseCode}
              onChangeText={(text) => setCourseData({...courseData, courseCode: text.toUpperCase()})}
              autoCapitalize="characters"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Course Name *</Text>
            <TextInput
              style={styles.modernInput}
              placeholder="Enter course name"
              value={courseData.courseName}
              onChangeText={(text) => setCourseData({...courseData, courseName: text})}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Instructor</Text>
            <TextInput
              style={styles.modernInput}
              placeholder="Enter instructor name"
              value={courseData.instructor}
              onChangeText={(text) => setCourseData({...courseData, instructor: text})}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Department</Text>
            <TextInput
              style={styles.modernInput}
              placeholder="Enter department"
              value={courseData.department}
              onChangeText={(text) => setCourseData({...courseData, department: text})}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Credits</Text>
            <TextInput
              style={styles.modernInput}
              placeholder="3"
              keyboardType="numeric"
              value={courseData.credits}
              onChangeText={(text) => setCourseData({...courseData, credits: text})}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={[styles.modernInput, styles.textArea]}
              placeholder="Course description"
              multiline
              numberOfLines={3}
              value={courseData.description}
              onChangeText={(text) => setCourseData({...courseData, description: text})}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Schedule Days</Text>
            <View style={styles.daysContainer}>
              {days.map(day => (
                <TouchableOpacity
                  key={day}
                  style={[
                    styles.dayChip,
                    courseData.schedule.days.includes(day) && styles.selectedDayChip
                  ]}
                  onPress={() => toggleDay(day)}
                >
                  <Text style={[
                    styles.dayChipText,
                    courseData.schedule.days.includes(day) && styles.selectedDayChipText
                  ]}>
                    {day.substring(0, 3)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Time</Text>
            <TextInput
              style={styles.modernInput}
              placeholder="e.g., 09:00-10:30"
              value={courseData.schedule.time}
              onChangeText={(text) => setCourseData({
                ...courseData,
                schedule: { ...courseData.schedule, time: text }
              })}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Room</Text>
            <TextInput
              style={styles.modernInput}
              placeholder="e.g., CS-101"
              value={courseData.schedule.room}
              onChangeText={(text) => setCourseData({
                ...courseData,
                schedule: { ...courseData.schedule, room: text }
              })}
            />
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.disabledButton]}
            onPress={handleCreateCourse}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>Create Course</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// Attendance Reports Screen
const AttendanceReportsScreen = ({ navigation }) => {
  const [reports, setReports] = useState({});
  const [loading, setLoading] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [courses, setCourses] = useState([]);

  useEffect(() => {
    loadCourses();
    loadReports();
  }, [selectedCourse]);

  const loadCourses = async () => {
    try {
      const response = await apiCall('/admin/courses');
      if (response.success) {
        setCourses(response.data || []);
      }
    } catch (error) {
      console.error('Failed to load courses:', error);
    }
  };

  const loadReports = async () => {
    setLoading(true);
    try {
      let params = '';
      if (selectedCourse) params += `?courseCode=${selectedCourse}`;
      
      const response = await apiCall(`/admin/analytics${params}`);
      if (response.success) {
        setReports(response.data);
      }
    } catch (error) {
      showError('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.reportsHeader}>
        <Text style={styles.reportsTitle}>Attendance Reports</Text>
        <Text style={styles.reportsSubtitle}>Analytics and insights</Text>
      </View>

      <View style={styles.filterSection}>
        <Text style={styles.filterLabel}>Filter by Course:</Text>
        <View style={styles.pickerWrapper}>
          <Picker
            selectedValue={selectedCourse}
            style={styles.coursePicker}
            onValueChange={setSelectedCourse}
          >
            <Picker.Item label="All Courses" value="" />
            {courses.map(course => (
              <Picker.Item
                key={course.courseCode}
                label={`${course.courseCode} - ${course.courseName}`}
                value={course.courseCode}
              />
            ))}
          </Picker>
        </View>
      </View>

      <ScrollView style={styles.reportsContainer}>
        <View style={styles.reportCard}>
          <Text style={styles.reportCardTitle}>Overview Statistics</Text>
          <View style={styles.reportMetrics}>
            <View style={styles.reportMetric}>
              <Text style={styles.reportMetricValue}>{reports.overview?.totalStudents || 0}</Text>
              <Text style={styles.reportMetricLabel}>Students</Text>
            </View>
            <View style={styles.reportMetric}>
              <Text style={styles.reportMetricValue}>{reports.overview?.overallAttendanceRate || 0}%</Text>
              <Text style={styles.reportMetricLabel}>Attendance Rate</Text>
            </View>
            <View style={styles.reportMetric}>
              <Text style={styles.reportMetricValue}>{reports.overview?.totalAttendanceRecords || 0}</Text>
              <Text style={styles.reportMetricLabel}>Total Records</Text>
            </View>
          </View>
        </View>

        <View style={styles.reportCard}>
          <Text style={styles.reportCardTitle}>Course Performance</Text>
          {reports.coursePerformance?.map((course, index) => (
            <View key={index} style={styles.coursePerformanceItem}>
              <View style={styles.coursePerformanceHeader}>
                <Text style={styles.courseCode}>{course.courseCode}</Text>
                <Text style={styles.courseAttendanceRate}>{course.attendanceRate?.toFixed(1) || 0}%</Text>
              </View>
              <View style={styles.courseProgressBar}>
                <View 
                  style={[
                    styles.progressFill,
                    { width: `${course.attendanceRate || 0}%` }
                  ]}
                />
              </View>
            </View>
          ))}
        </View>

        <View style={styles.reportCard}>
          <Text style={styles.reportCardTitle}>Top Performing Students</Text>
          {reports.topStudents?.map((student, index) => (
            <View key={index} style={styles.topStudentItem}>
              <Text style={styles.topStudentRank}>{index + 1}</Text>
              <View style={styles.topStudentInfo}>
                <Text style={styles.topStudentName}>{student.studentName}</Text>
                <Text style={styles.topStudentId}>{student.studentId}</Text>
              </View>
              <Text style={styles.topStudentRate}>{student.attendanceRate?.toFixed(1) || 0}%</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// Notifications Screen
const NotificationsScreen = ({ navigation }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const response = await apiCall('/notifications');
      if (response.success) {
        setNotifications(response.data.notifications || []);
        setUnreadCount(response.data.unreadCount || 0);
      }
    } catch (error) {
      showError('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      const response = await apiCall(`/notifications/${notificationId}/read`, {
        method: 'PUT'
      });
      if (response.success) {
        loadNotifications();
      }
    } catch (error) {
      showError('Failed to mark notification as read');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.notificationsHeader}>
        <Text style={styles.notificationsTitle}>Notifications</Text>
        {unreadCount > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
          </View>
        )}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item._id}
        refreshing={loading}
        onRefresh={loadNotifications}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.notificationItem,
              !item.isRead && styles.unreadNotification
            ]}
            onPress={() => !item.isRead && markAsRead(item._id)}
          >
            <View style={styles.notificationIcon}>
              <Text style={styles.notificationEmoji}>
                {item.type === 'success' ? '✅' : 
                 item.type === 'warning' ? '⚠️' : 
                 item.type === 'error' ? '❌' : 'ℹ️'}
              </Text>
            </View>
            <View style={styles.notificationContent}>
              <Text style={styles.notificationTitle}>{item.title}</Text>
              <Text style={styles.notificationMessage}>{item.message}</Text>
              <Text style={styles.notificationTime}>
                {new Date(item.createdAt).toLocaleString()}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No notifications</Text>
            <Text style={styles.emptySubtext}>You're all caught up!</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

// Material Management Screen
const MaterialManagementScreen = ({ navigation }) => {
  const [materials, setMaterials] = useState([]);
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadModal, setUploadModal] = useState(false);
  const [uploadData, setUploadData] = useState({
    title: '',
    description: '',
    courseCode: '',
    materialType: 'document'
  });

  useEffect(() => {
    loadCourses();
    loadMaterials();
  }, [selectedCourse]);

  const loadCourses = async () => {
    try {
      const response = await apiCall('/admin/courses');
      if (response.success) {
        setCourses(response.data || []);
      }
    } catch (error) {
      showError('Failed to load courses');
    }
  };

  const loadMaterials = async () => {
    try {
      setLoading(true);
      const courseCode = selectedCourse || 'ICT651';
      const response = await apiCall(`/materials/${courseCode}`);
      if (response.success) {
        setMaterials(response.data.materials || []);
      }
    } catch (error) {
      showError('Failed to load materials');
    } finally {
      setLoading(false);
    }
  };

  const uploadMaterial = async () => {
    if (!uploadData.title || !uploadData.courseCode) {
      showError('Please fill required fields');
      return;
    }

    try {
      const response = await apiCall('/admin/materials', {
        method: 'POST',
        body: JSON.stringify(uploadData),
      });

      if (response.success) {
        showSuccess('Material uploaded successfully');
        setUploadModal(false);
        setUploadData({ title: '', description: '', courseCode: '', materialType: 'document' });
        loadMaterials();
      }
    } catch (error) {
      showError(error.message);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.screenHeader}>
        <Text style={styles.screenTitle}>Course Materials</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setUploadModal(true)}
        >
          <Text style={styles.addButtonText}>+ Upload</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filterSection}>
        <Text style={styles.filterLabel}>Filter by Course:</Text>
        <View style={styles.pickerWrapper}>
          <Picker
            selectedValue={selectedCourse}
            style={styles.coursePicker}
            onValueChange={(value) => setSelectedCourse(value)}
          >
            <Picker.Item label="All Courses" value="" />
            {courses.map(course => (
              <Picker.Item
                key={course.courseCode}
                label={`${course.courseCode} - ${course.courseName}`}
                value={course.courseCode}
              />
            ))}
          </Picker>
        </View>
      </View>

      <FlatList
        data={materials}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <View style={styles.materialCard}>
            <View style={styles.materialHeader}>
              <Text style={styles.materialTitle}>{item.title}</Text>
              <Text style={styles.materialCourse}>{item.courseCode}</Text>
            </View>
            <Text style={styles.materialDescription}>{item.description}</Text>
            <View style={styles.materialFooter}>
              <Text style={styles.materialDate}>
                {new Date(item.createdAt).toLocaleDateString()}
              </Text>
              <Text style={styles.materialType}>{item.materialType.toUpperCase()}</Text>
            </View>
          </View>
        )}
        refreshing={loading}
        onRefresh={loadMaterials}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No materials found</Text>
            <Text style={styles.emptySubtext}>Upload your first material to get started</Text>
          </View>
        }
      />

      {/* Upload Modal */}
      <Modal
        visible={uploadModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setUploadModal(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Upload Material</Text>
            <TouchableOpacity onPress={uploadMaterial}>
              <Text style={styles.modalSave}>Upload</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Title *</Text>
              <TextInput
                style={styles.modalInput}
                value={uploadData.title}
                onChangeText={(text) => setUploadData({ ...uploadData, title: text })}
                placeholder="Enter material title"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Course *</Text>
              <View style={styles.pickerWrapper}>
                                  <Picker
                  selectedValue={uploadData.courseCode}
                  style={styles.modalPicker}
                  onValueChange={(value) => setUploadData({ ...uploadData, courseCode: value })}
                >
                  <Picker.Item label="Select Course" value="" />
                  {courses.map(course => (
                    <Picker.Item
                      key={course.courseCode}
                      label={`${course.courseCode} - ${course.courseName}`}
                      value={course.courseCode}
                    />
                  ))}
                </Picker>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={[styles.modalInput, styles.textArea]}
                value={uploadData.description}
                onChangeText={(text) => setUploadData({ ...uploadData, description: text })}
                placeholder="Enter description (optional)"
                multiline
                numberOfLines={3}
              />
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

// Enhanced Student Dashboard
const StudentDashboardScreen = ({ navigation }) => {
  const [userInfo, setUserInfo] = useState({});
  const [dashboardData, setDashboardData] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [faceRegistered, setFaceRegistered] = useState(false);
  const [showFaceRegistration, setShowFaceRegistration] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [isRegistering, setIsRegistering] = useState(false);

  useEffect(() => {
    loadDashboardData();
    checkFaceRegistration();
  }, []);

  const loadDashboardData = async () => {
    try {
      const info = await AsyncStorage.getItem('userInfo');
      if (info) {
        setUserInfo(JSON.parse(info));
      }

      const response = await apiCall('/student/dashboard');
      if (response.success) {
        setDashboardData(response.data);
      }
    } catch (error) {
      console.error('Dashboard error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.multiRemove(['userToken', 'userRole', 'userInfo']);
            navigation.replace('Login');
          }
        }
      ]
    );
  };

  const checkFaceRegistration = async () => {
    try {
      const response = await apiCall('/student/face/status');
      setFaceRegistered(response.data.isRegistered);
    } catch (error) {
      setFaceRegistered(false);
    }
  };

  const captureFacePhoto = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        showError('Camera permission is required');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: false
      });

      if (!result.canceled) {
        setCapturedImage(result.assets[0].uri);
      }
    } catch (error) {
      showError('Failed to capture photo: ' + error.message);
    }
  };

  const registerFace = async () => {
    if (!capturedImage) {
      showError('Please capture a photo first');
      return;
    }

    setIsRegistering(true);
    try {
      const base64 = await FileSystem.readAsStringAsync(capturedImage, { 
        encoding: FileSystem.EncodingType.Base64 
      });
      
      const response = await apiCall('/student/face/register-image', {
        method: 'POST',
        body: JSON.stringify({ imageBase64: base64 })
      });
      
      if (response.success) {
        showSuccess('Face registered successfully!');
        setFaceRegistered(true);
        setShowFaceRegistration(false);
        setCapturedImage(null);
      }
    } catch (error) {
      showError('Failed to register face: ' + error.message);
    } finally {
      setIsRegistering(false);
    }
  };

  const retakePhoto = () => {
    setCapturedImage(null);
  };

  if (loading) return <LoadingScreen message="Loading your dashboard..." />;

  const stats = dashboardData.statistics || {};

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#1976D2" barStyle="light-content" />
      
      <View style={styles.studentHeader}>
        <View>
          <Text style={styles.studentWelcome}>Welcome back,</Text>
          <Text style={styles.studentName}>{dashboardData.student?.name || userInfo.studentName}</Text>
          <Text style={styles.studentId}>ID: {userInfo.studentId}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutIconButton}>
          <Text style={styles.logoutIcon}>⚙</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.studentContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Attendance Overview */}
        <View style={styles.attendanceOverview}>
          <View style={styles.overviewHeader}>
            <Text style={styles.overviewTitle}>Attendance Overview</Text>
            <View style={styles.overviewBadge}>
              <Text style={styles.overviewPercentage}>{stats.overallPercentage || 0}%</Text>
            </View>
          </View>
          
          <View style={styles.attendanceStats}>
            <View style={styles.attendanceStat}>
              <Text style={styles.attendanceNumber}>{stats.presentSessions || 0}</Text>
              <Text style={styles.attendanceLabel}>Present</Text>
              <View style={[styles.statBar, styles.presentBar]} />
            </View>
            
            <View style={styles.attendanceStat}>
              <Text style={styles.attendanceNumber}>{stats.lateSessions || 0}</Text>
              <Text style={styles.attendanceLabel}>Late</Text>
              <View style={[styles.statBar, styles.lateBar]} />
            </View>
            
            <View style={styles.attendanceStat}>
              <Text style={styles.attendanceNumber}>{stats.absentSessions || 0}</Text>
              <Text style={styles.attendanceLabel}>Absent</Text>
              <View style={[styles.statBar, styles.absentBar]} />
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActionsStudent}>
          <TouchableOpacity
            style={styles.primaryAction}
            onPress={() => navigation.navigate('MarkAttendance')}
          >
            <View style={styles.primaryActionIcon}>
              <Text style={styles.primaryActionEmoji}>📷</Text>
            </View>
            <View style={styles.primaryActionContent}>
              <Text style={styles.primaryActionTitle}>Mark Attendance</Text>
              <Text style={styles.primaryActionSubtitle}>Use face recognition to check in</Text>
            </View>
            <Text style={styles.primaryActionArrow}>→</Text>
          </TouchableOpacity>

          <View style={styles.secondaryActions}>
            <TouchableOpacity
              style={styles.secondaryAction}
              onPress={() => navigation.navigate('AttendanceHistory')}
            >
              <Text style={styles.secondaryActionEmoji}>📊</Text>
              <Text style={styles.secondaryActionText}>View History</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryAction}
              onPress={() => navigation.navigate('StudentMaterials')}
            >
              <Text style={styles.secondaryActionEmoji}>📚</Text>
              <Text style={styles.secondaryActionText}>Course Materials</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Course Performance */}
        <View style={styles.coursePerformance}>
          <Text style={styles.sectionTitle}>Course Performance</Text>
          {Object.entries(dashboardData.courseStats || {}).map(([courseCode, stats]) => (
            <View key={courseCode} style={styles.courseCard}>
              <View style={styles.courseHeader}>
                <Text style={styles.courseCode}>{courseCode}</Text>
                <Text style={styles.coursePercentage}>{stats.percentage}%</Text>
              </View>
              <View style={styles.courseProgress}>
                <View 
                  style={[
                    styles.progressBar, 
                    { width: `${stats.percentage}%` }
                  ]} 
                />
              </View>
              <Text style={styles.courseStats}>
                {stats.present + stats.late}/{stats.total} sessions attended
              </Text>
            </View>
          ))}
        </View>

        {/* Recent Activity */}
        <View style={styles.recentActivity}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          {dashboardData.recentAttendance?.slice(0, 5).map((record) => (
            <View key={record._id} style={styles.activityRecord}>
              <View style={styles.activityIcon}>
                <Text style={styles.activityEmoji}>
                  {record.status === 'present' ? '✅' : record.status === 'late' ? '🕒' : '❌'}
                </Text>
              </View>
              <View style={styles.activityDetails}>
                <Text style={styles.activityCourse}>{record.courseCode}</Text>
                <Text style={styles.activityDate}>
                  {new Date(record.timestamp).toLocaleDateString()}
                </Text>
              </View>
              <Text style={[
                styles.activityStatus,
                { color: record.status === 'present' ? '#4CAF50' : record.status === 'late' ? '#FF9800' : '#F44336' }
              ]}>
                {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
              </Text>
            </View>
          ))}

          {(!dashboardData.recentAttendance || dashboardData.recentAttendance.length === 0) && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No attendance records yet</Text>
              <Text style={styles.emptySubtext}>Mark your first attendance to get started</Text>
            </View>
          )}
        </View>

        {!faceRegistered && (
          <View style={styles.faceRegistrationCard}>
            <Text style={styles.faceRegistrationTitle}>⚠️ Face Registration Required</Text>
            <Text style={styles.faceRegistrationText}>
              You need to register your face before marking attendance
            </Text>
            <TouchableOpacity
              style={styles.faceRegistrationButton}
              onPress={() => setShowFaceRegistration(true)}
            >
              <Text style={styles.faceRegistrationButtonText}>Register Face Now</Text>
            </TouchableOpacity>
          </View>
        )}

        {showFaceRegistration && (
          <Modal
            visible={showFaceRegistration}
            animationType="slide"
            presentationStyle="pageSheet"
          >
            <SafeAreaView style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => {
                  setShowFaceRegistration(false);
                  setCapturedImage(null);
                }}>
                  <Text style={styles.modalCancel}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.modalTitle}>Register Your Face</Text>
                <View style={{ width: 60 }} />
              </View>
              
              <ScrollView style={styles.faceRegistrationModalContent}>
                {!capturedImage ? (
                  <View style={styles.faceCaptureSection}>
                    <View style={styles.faceCaptureFrame}>
                      <Text style={styles.faceCaptureIcon}>📷</Text>
                      <Text style={styles.faceCaptureText}>Tap to capture your face</Text>
                    </View>
                    <Text style={styles.faceRegistrationInstructions}>
                      Position your face within the frame and ensure good lighting for better recognition accuracy
                    </Text>
                    <TouchableOpacity
                      style={styles.captureButton}
                      onPress={captureFacePhoto}
                    >
                      <Text style={styles.captureButtonText}>📷 Take Photo</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.facePreviewSection}>
                    <View style={styles.facePreviewContainer}>
                      <Image source={{ uri: capturedImage }} style={styles.facePreviewImage} />
                      <View style={styles.facePreviewOverlay}>
                        <Text style={styles.facePreviewText}>✓ Captured</Text>
                      </View>
                    </View>
                    <Text style={styles.faceRegistrationInstructions}>
                      Review your photo. Make sure your face is clearly visible and well-lit.
                    </Text>
                    <View style={styles.facePreviewActions}>
                      <TouchableOpacity
                        style={styles.retakeButton}
                        onPress={retakePhoto}
                      >
                        <Text style={styles.retakeButtonText}>🔄 Retake</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.registerButton, isRegistering && styles.disabledButton]}
                        onPress={registerFace}
                        disabled={isRegistering}
                      >
                        {isRegistering ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <Text style={styles.registerButtonText}>✓ Register</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </ScrollView>
            </SafeAreaView>
          </Modal>
        )}

      </ScrollView>
    </SafeAreaView>
  );
};

// Enhanced Mark Attendance Screen
const MarkAttendanceScreen = ({ navigation }) => {
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [cameraVisible, setCameraVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [matching, setMatching] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    loadCourses();
  }, []);

  const loadCourses = async () => {
    try {
      const response = await apiCall('/student/courses');
      if (response.success) {
        setCourses(response.data);
      }
    } catch (error) {
      showError('Failed to load courses');
    }
  };

  const startAttendanceProcess = async () => {
    if (!selectedCourse) {
      showError('Please select a course first');
      return;
    }

    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        showError('Camera permission is required for face recognition');
        return;
      }
    }

    setCameraVisible(true);
    setScanning(true);
  };

  const processAttendance = async () => {
    setLoading(true);
    setMatching(true);
    try {
      // Capture one photo frame for attendance
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: false
      });
      if (result.canceled) {
        setScanning(false);
        setLoading(false);
        setMatching(false);
        return;
      }
      const base64 = await FileSystem.readAsStringAsync(result.assets[0].uri, { encoding: FileSystem.EncodingType.Base64 });

      // Simulate face matching process
      setTimeout(async () => {
        try {
          const response = await apiCall('/student/attendance-image', {
            method: 'POST',
            body: JSON.stringify({
              courseCode: selectedCourse,
              imageBase64: base64,
              location: { latitude: 0, longitude: 0 }
            }),
          });

          if (response.success) {
            setCameraVisible(false);
            setScanning(false);
            setMatching(false);
            const attendanceData = response.data;
            Alert.alert(
              '✅ Attendance Recorded',
              `Successfully marked ${attendanceData.status} for ${attendanceData.courseCode}${attendanceData.isLate ? ` (${attendanceData.lateMinutes} minutes late)` : ''}`,
              [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
          }
        } catch (error) {
          setScanning(false);
          setMatching(false);
          showError(error.message);
        } finally {
          setLoading(false);
        }
      }, 2000); // 2 second delay for professional feel
    } catch (error) {
      setScanning(false);
      setMatching(false);
      showError(error.message);
      setLoading(false);
    }
  };

  if (cameraVisible) {
    return (
      <View style={styles.cameraContainer}>
        <CameraView style={styles.camera} facing="front">
          <View style={styles.cameraOverlay}>
            <View style={styles.scanningFrame}>
              <View style={[styles.faceFrame, matching && styles.faceFrameMatching]} />
              {scanning && !matching && (
                <View style={styles.scanningAnimation}>
                  <ActivityIndicator size="large" color="#fff" />
                </View>
              )}
              {matching && (
                <View style={styles.matchingAnimation}>
                  <View style={styles.matchingIcon}>
                    <Text style={styles.matchingEmoji}>🔍</Text>
                  </View>
                  <Text style={styles.matchingText}>Matching Face...</Text>
                  <View style={styles.matchingProgress}>
                    <View style={styles.matchingProgressBar} />
                  </View>
                </View>
              )}
            </View>
            
            <Text style={styles.cameraInstructions}>
              {matching ? 'Verifying your identity...' : 'Position your face within the frame'}
            </Text>
            
            {!matching && (
              <View style={styles.cameraControls}>
                <TouchableOpacity
                  style={styles.cancelScanButton}
                  onPress={() => {
                    setCameraVisible(false);
                    setScanning(false);
                  }}
                >
                  <Text style={styles.controlButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.scanButton, (loading || !scanning) && styles.disabledScanButton]}
                  onPress={processAttendance}
                  disabled={loading || !scanning}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.controlButtonText}>
                      {scanning ? '📷 Capture' : 'Processing...'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </CameraView>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.attendanceContainer}>
        <View style={styles.attendanceHeader}>
          <Text style={styles.attendanceTitle}>Mark Your Attendance</Text>
          <Text style={styles.attendanceSubtitle}>Select a course and use face recognition</Text>
        </View>

        <View style={styles.courseSelectionCard}>
          <Text style={styles.cardTitle}>Select Course</Text>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={selectedCourse}
              style={styles.coursePicker}
              onValueChange={setSelectedCourse}
            >
              <Picker.Item label="Choose your course..." value="" />
              {courses.map(course => (
                <Picker.Item
                  key={course.courseCode}
                  label={`${course.courseCode} - ${course.courseName}`}
                  value={course.courseCode}
                />
              ))}
            </Picker>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.startAttendanceButton, !selectedCourse && styles.disabledButton]}
          onPress={startAttendanceProcess}
          disabled={!selectedCourse}
        >
          <View style={styles.startButtonContent}>
            <Text style={styles.startButtonEmoji}>📷</Text>
            <View style={styles.startButtonText}>
              <Text style={styles.startButtonTitle}>Start Face Recognition</Text>
              <Text style={styles.startButtonSubtitle}>Tap to begin attendance marking</Text>
            </View>
          </View>
        </TouchableOpacity>

        <View style={styles.instructionsCard}>
          <Text style={styles.instructionsTitle}>How it works</Text>
          <View style={styles.instructionsList}>
            <View style={styles.instructionItem}>
              <Text style={styles.instructionNumber}>1</Text>
              <Text style={styles.instructionText}>Select your course from the list above</Text>
            </View>
            <View style={styles.instructionItem}>
              <Text style={styles.instructionNumber}>2</Text>
              <Text style={styles.instructionText}>Tap "Start Face Recognition"</Text>
            </View>
            <View style={styles.instructionItem}>
              <Text style={styles.instructionNumber}>3</Text>
              <Text style={styles.instructionText}>Position your face within the frame</Text>
            </View>
            <View style={styles.instructionItem}>
              <Text style={styles.instructionNumber}>4</Text>
              <Text style={styles.instructionText}>Wait for recognition and confirmation</Text>
            </View>
          </View>
        </View>

        {courses.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No courses available</Text>
            <Text style={styles.emptySubtext}>Contact your administrator to enroll in courses</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

// Student Materials Screen
const StudentMaterialsScreen = () => {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadStudentMaterials();
  }, []);

  const loadStudentMaterials = async () => {
    try {
      setLoading(true);
      const response = await apiCall('/student/materials');
      if (response.success) {
        setMaterials(response.data.materials || []);
      }
    } catch (error) {
      showError('Failed to load materials');
    } finally {
      setLoading(false);
    }
  };

  const downloadMaterial = async (materialId, fileName) => {
    try {
      // In a real implementation, this would trigger the download
      showSuccess(`${fileName} download started`);
    } catch (error) {
      showError('Failed to download material');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.materialsHeader}>
        <Text style={styles.materialsTitle}>Course Materials</Text>
        <Text style={styles.materialsSubtitle}>Access your learning resources</Text>
      </View>

      <FlatList
        data={materials}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <View style={styles.materialItem}>
            <View style={styles.materialIcon}>
              <Text style={styles.materialTypeIcon}>
                {item.materialType === 'pdf' ? '📄' : 
                 item.materialType === 'image' ? '🖼️' : 
                 item.materialType === 'link' ? '🔗' : '📎'}
              </Text>
            </View>
            <View style={styles.materialContent}>
              <Text style={styles.materialTitle}>{item.title}</Text>
              <Text style={styles.materialCourse}>{item.courseCode}</Text>
              <Text style={styles.materialDate}>
                {new Date(item.createdAt).toLocaleDateString()}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.downloadButton}
              onPress={() => downloadMaterial(item._id, item.fileName)}
            >
              <Text style={styles.downloadIcon}>⬇</Text>
            </TouchableOpacity>
          </View>
        )}
        refreshing={loading}
        onRefresh={loadStudentMaterials}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No materials available</Text>
            <Text style={styles.emptySubtext}>Materials will appear here when uploaded by instructors</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

// Attendance History Screen
const AttendanceHistoryScreen = ({ navigation }) => {
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('all');

  useEffect(() => {
    loadAttendanceHistory();
  }, [selectedFilter]);

  const loadAttendanceHistory = async () => {
    setLoading(true);
    try {
      const response = await apiCall('/student/dashboard');
      if (response.success && response.data.recentAttendance) {
        setAttendanceHistory(response.data.recentAttendance);
      }
    } catch (error) {
      showError('Failed to load attendance history');
    } finally {
      setLoading(false);
    }
  };

  const getFilteredHistory = () => {
    if (selectedFilter === 'all') return attendanceHistory;
    return attendanceHistory.filter(record => record.status === selectedFilter);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.historyHeader}>
        <Text style={styles.historyTitle}>Attendance History</Text>
        <Text style={styles.historySubtitle}>View your attendance records</Text>
      </View>

      <View style={styles.historyFilters}>
        {['all', 'present', 'late', 'absent'].map(filter => (
          <TouchableOpacity
            key={filter}
            style={[
              styles.filterButton,
              selectedFilter === filter && styles.activeFilterButton
            ]}
            onPress={() => setSelectedFilter(filter)}
          >
            <Text style={[
              styles.filterButtonText,
              selectedFilter === filter && styles.activeFilterButtonText
            ]}>
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={getFilteredHistory()}
        keyExtractor={(item) => item._id}
        refreshing={loading}
        onRefresh={loadAttendanceHistory}
        renderItem={({ item }) => (
          <View style={styles.historyItem}>
            <View style={styles.historyDate}>
              <Text style={styles.historyDay}>
                {new Date(item.timestamp).getDate()}
              </Text>
              <Text style={styles.historyMonth}>
                {new Date(item.timestamp).toLocaleDateString('en', { month: 'short' })}
              </Text>
            </View>
            <View style={styles.historyDetails}>
              <Text style={styles.historyCourse}>{item.courseCode}</Text>
              <Text style={styles.historyTime}>
                {new Date(item.timestamp).toLocaleTimeString()}
              </Text>
            </View>
            <View style={[
              styles.historyStatusBadge,
              item.status === 'present' ? styles.presentBadge :
              item.status === 'late' ? styles.lateBadge : styles.absentBadge
            ]}>
              <Text style={[
                styles.historyStatusText,
                item.status === 'present' ? styles.presentText :
                item.status === 'late' ? styles.lateText : styles.absentText
              ]}>
                {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
              </Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No attendance records found</Text>
            <Text style={styles.emptySubtext}>Start marking attendance to see your history</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

// Main App Component
export default function App() {
  const [initialRoute, setInitialRoute] = useState(null);

  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const role = await AsyncStorage.getItem('userRole');
      
      if (token && role) {
        setInitialRoute(role === 'admin' ? 'AdminDashboard' : 'StudentDashboard');
      } else {
        setInitialRoute('Login');
      }
    } catch (error) {
      setInitialRoute('Login');
    }
  };

  if (!initialRoute) {
    return <LoadingScreen message="Initializing application..." />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={{
          headerStyle: { backgroundColor: '#1976D2' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '600' },
          headerBackTitleVisible: false,
        }}
      >
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Registration"
          component={RegistrationScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="AdminDashboard"
          component={AdminDashboardScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="StudentDashboard"
          component={StudentDashboardScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="CreateStudent"
          component={CreateStudentScreen}
          options={{ title: 'Create Student' }}
        />
        <Stack.Screen
          name="ViewStudents"
          component={ViewStudentsScreen}
          options={{ title: 'Manage Students' }}
        />
        <Stack.Screen
          name="CreateCourse"
          component={CreateCourseScreen}
          options={{ title: 'Create Course' }}
        />
        <Stack.Screen
          name="MaterialManagement"
          component={MaterialManagementScreen}
          options={{ title: 'Course Materials' }}
        />
        <Stack.Screen
          name="AttendanceReports"
          component={AttendanceReportsScreen}
          options={{ title: 'Attendance Reports' }}
        />
        <Stack.Screen
          name="Notifications"
          component={NotificationsScreen}
          options={{ title: 'Notifications' }}
        />
        <Stack.Screen
          name="MarkAttendance"
          component={MarkAttendanceScreen}
          options={{ title: 'Mark Attendance' }}
        />
        <Stack.Screen
          name="StudentMaterials"
          component={StudentMaterialsScreen}
          options={{ title: 'Course Materials' }}
        />
        <Stack.Screen
          name="AttendanceHistory"
          component={AttendanceHistoryScreen}
          options={{ title: 'Attendance History' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// Complete StyleSheet
const styles = StyleSheet.create({
  // Base Container Styles
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  
  // Loading Screen Styles
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
    textAlign: 'center',
  },

  // Registration Screen Styles
  registrationHeader: {
    backgroundColor: '#1976D2',
    paddingVertical: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 4,
  },
  backButton: {
    padding: 8,
    marginRight: 16,
    borderRadius: 20,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  registrationTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 20,
  },

  // Form Card Styles
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  formTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 24,
    letterSpacing: 0.5,
  },
  
  // Input Group Styles
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  modernInput: {
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#212529',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
    paddingTop: 14,
  },

  // Face Recording Section
  faceRecordingSection: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 20,
    marginTop: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  faceRecordingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  faceRecordingButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  faceRecordingButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  facePreview: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginTop: 12,
    borderWidth: 3,
    borderColor: '#4CAF50',
  },
  faceRecordingNote: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 8,
    paddingHorizontal: 16,
  },

  // Course Selection Grid
  courseSelectionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  courseChip: {
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    margin: 4,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  selectedCourseChip: {
    backgroundColor: '#1976D2',
    borderColor: '#1976D2',
  },
  courseChipText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  selectedCourseChipText: {
    color: '#fff',
  },

  // User Type Container
  userTypeContainer: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 4,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  userTypeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderRadius: 8,
    marginHorizontal: 2,
  },
  activeUserType: {
    backgroundColor: '#1976D2',
    shadowColor: '#1976D2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
        elevation: 3,
  },
  userTypeText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6c757d',
  },
  activeUserTypeText: {
    color: '#fff',
  },

  // Login Screen Styles
  loginHeader: {
    backgroundColor: '#1976D2',
    paddingVertical: 50,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  logoImage: {
    width: 160,
    height: 160,
    marginBottom: 16,
    borderRadius: 80,
    borderWidth: 3,
    borderColor: '#fff',
    backgroundColor: '#ffffff',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  appTitle: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  appSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '400',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  validationText: {
    color: '#d32f2f',
    marginTop: 6,
    fontSize: 12,
  },
  loginContainer: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  loginCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 28,
    marginTop: -20,
    marginHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  formSection: {
    marginBottom: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },

  // Button Styles
  primaryButton: {
    backgroundColor: '#1976D2',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#1976D2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  disabledButton: {
    backgroundColor: '#adb5bd',
    shadowOpacity: 0,
    elevation: 0,
  },
  linkButton: {
    marginTop: 20,
    alignItems: 'center',
    paddingVertical: 8,
  },
  linkText: {
    color: '#1976D2',
    fontSize: 14,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  registerLink: {
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 10,
  },
  registerLinkText: {
    color: '#1976D2',
    fontSize: 14,
    fontWeight: '500',
  },

  // Help Section
  helpSection: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginTop: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  helpTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 8,
    textAlign: 'center',
  },
  helpText: {
    fontSize: 13,
    color: '#6c757d',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 2,
  },

  // Footer Styles
  footerContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  footerText: {
    fontSize: 12,
    color: '#6c757d',
    textAlign: 'center',
    marginBottom: 4,
  },
  versionText: {
    fontSize: 11,
    color: '#adb5bd',
    textAlign: 'center',
  },

  // Dashboard Header Styles
  professionalHeader: {
    backgroundColor: '#1976D2',
    paddingVertical: 24,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    elevation: 4,
  },
  studentHeader: {
    backgroundColor: '#1976D2',
    paddingVertical: 24,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    elevation: 4,
  },
  headerWelcome: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
    fontWeight: '400',
  },
  studentWelcome: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
    fontWeight: '400',
  },
  headerName: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 4,
    letterSpacing: 0.5,
  },
  studentName: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 4,
    letterSpacing: 0.5,
  },
  headerRole: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 2,
  },
  studentId: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 2,
  },
  logoutIconButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  logoutIcon: {
    color: '#fff',
    fontSize: 20,
  },

  // Dashboard Content
  dashboardContent: {
    flex: 1,
    padding: 20,
  },
  studentContent: {
    flex: 1,
    padding: 20,
  },

  // Analytics Section
  analyticsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: 12,
    justifyContent: 'space-between',
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginHorizontal: 6,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1976D2',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    fontWeight: '500',
    letterSpacing: 0.3,
  },

  // Quick Actions Section
  quickActionsSection: {
    marginBottom: 24,
  },
  quickActionsStudent: {
    marginBottom: 24,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  actionCard: {
    width: '48%',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 6,
    marginBottom: 12,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0f7ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionEmoji: {
    fontSize: 24,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  actionSubtitle: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
    lineHeight: 16,
  },

  // Primary Action for Students
  primaryAction: {
    backgroundColor: '#1976D2',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  primaryActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  primaryActionEmoji: {
    fontSize: 28,
  },
  primaryActionContent: {
    flex: 1,
  },
  primaryActionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  primaryActionSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '400',
  },
  primaryActionArrow: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },

  // Secondary Actions
  secondaryActions: {
    flexDirection: 'row',
  },
  secondaryAction: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 6,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  secondaryActionEmoji: {
    fontSize: 24,
    marginBottom: 8,
  },
  secondaryActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    letterSpacing: 0.3,
  },

  // Continue with rest of styles...
  // Student Management Styles
  createStudentContainer: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f8f9fa',
  },
  searchContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  searchInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  studentItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    alignItems: 'center',
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  studentIdText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  studentCourses: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    lineHeight: 16,
  },
  studentActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deleteButton: {
    backgroundColor: '#f44336',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },

  // Course Creation Styles
  createCourseContainer: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f8f9fa',
  },
  daysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  dayChip: {
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    margin: 4,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  selectedDayChip: {
    backgroundColor: '#1976D2',
    borderColor: '#1976D2',
  },
  dayChipText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  selectedDayChipText: {
    color: '#fff',
  },

  // Additional missing styles that are referenced
  attendanceOverview: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  overviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  overviewTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  overviewBadge: {
    backgroundColor: '#1976D2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  overviewPercentage: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  attendanceStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  attendanceStat: {
    alignItems: 'center',
    flex: 1,
  },
  attendanceNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  attendanceLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    fontWeight: '500',
  },
  statBar: {
    width: 32,
    height: 4,
    borderRadius: 2,
  },
  presentBar: {
    backgroundColor: '#4CAF50',
  },
  lateBar: {
    backgroundColor: '#FF9800',
  },
  absentBar: {
    backgroundColor: '#F44336',
  },

  // Course Performance
  coursePerformance: {
    marginBottom: 24,
  },
  courseCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  courseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  courseCode: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  coursePercentage: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976D2',
  },
  courseProgress: {
    height: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 3,
    marginBottom: 8,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#1976D2',
    borderRadius: 3,
  },
  courseStats: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },

  // Recent Activity
  recentSection: {
    marginBottom: 24,
  },
  recentActivity: {
    marginBottom: 24,
  },
  activityItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  activityRecord: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  activityDate: {
    width: 48,
    alignItems: 'center',
    marginRight: 16,
  },
  activityDay: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  activityMonth: {
    fontSize: 11,
    color: '#666',
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityEmoji: {
    fontSize: 18,
  },
  activityDetails: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  activitySubtitle: {
    fontSize: 12,
    color: '#666',
  },
  activityCourse: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  activityStatus: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusBadge: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  successBadge: {
    backgroundColor: '#e8f5e8',
    color: '#4CAF50',
  },

  // Reports and Analytics
  reportsHeader: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  reportsTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  reportsSubtitle: {
    fontSize: 16,
    color: '#666',
  },
  reportsContainer: {
    flex: 1,
    padding: 20,
  },
  filterSection: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    backgroundColor: '#fafafa',
  },
  coursePicker: {
    height: 50,
    color: '#333',
  },
  reportCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  reportCardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  reportMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  reportMetric: {
    alignItems: 'center',
    flex: 1,
  },
  reportMetricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1976D2',
    marginBottom: 4,
  },
  reportMetricLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
    textAlign: 'center',
  },
  coursePerformanceItem: {
    marginBottom: 16,
  },
  coursePerformanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  courseAttendanceRate: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1976D2',
  },
  courseProgressBar: {
    height: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 3,
  },
  progressFill: {
    height: 6,
    backgroundColor: '#1976D2',
    borderRadius: 3,
  },
  topStudentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  topStudentRank: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976D2',
    width: 30,
    textAlign: 'center',
  },
  topStudentInfo: {
    flex: 1,
    marginLeft: 16,
  },
  topStudentName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  topStudentId: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  topStudentRate: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4CAF50',
  },

  // Notifications
  notificationsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  notificationsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  unreadBadge: {
    backgroundColor: '#f44336',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 24,
    alignItems: 'center',
  },
  unreadBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  notificationItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    alignItems: 'center',
  },
  unreadNotification: {
    backgroundColor: '#f8f9ff',
    borderLeftWidth: 4,
    borderLeftColor: '#1976D2',
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f7ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationEmoji: {
    fontSize: 18,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  notificationMessage: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
  },
  notificationTime: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
  },

  // Material Management
  screenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    elevation: 2,
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  addButton: {
    backgroundColor: '#1976D2',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 2,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  materialCard: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginVertical: 6,
    padding: 16,
    borderRadius: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  materialHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  materialTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    marginRight: 12,
  },
  materialCourse: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1976D2',
    backgroundColor: '#f0f7ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  materialDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    lineHeight: 20,
  },
  materialFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  materialDate: {
    fontSize: 12,
    color: '#999',
  },
  materialType: {
    fontSize: 10,
    fontWeight: '600',
    color: '#666',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    textTransform: 'uppercase',
  },

  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    elevation: 2,
    backgroundColor: '#fff',
  },
  modalCancel: {
    color: '#666',
    fontSize: 16,
    fontWeight: '500',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  modalSave: {
    color: '#1976D2',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f8f9fa',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fafafa',
    color: '#333',
  },
  modalPicker: {
    height: 50,
    color: '#333',
  },

  // Attendance Marking Styles
  attendanceContainer: {
    flex: 1,
    padding: 20,
  },
  attendanceHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  attendanceTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  attendanceSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  courseSelectionCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  startAttendanceButton: {
    backgroundColor: '#1976D2',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  startButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  startButtonEmoji: {
    fontSize: 32,
    marginRight: 16,
  },
  startButtonText: {
    flex: 1,
  },
  startButtonTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  startButtonSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
  },
  instructionsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  instructionsList: {
    marginTop: 8,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  instructionNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#1976D2',
    color: '#fff',
    textAlign: 'center',
    lineHeight: 24,
    fontSize: 12,
    fontWeight: 'bold',
    marginRight: 12,
  },
  instructionText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },

  // Camera Screen Styles
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanningFrame: {
    position: 'relative',
    marginBottom: 40,
  },
  faceFrame: {
    width: 250,
    height: 250,
    borderWidth: 3,
    borderColor: '#fff',
    borderRadius: 125,
    borderStyle: 'dashed',
  },
  scanningAnimation: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -20,
    marginLeft: -20,
  },
  cameraInstructions: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 60,
    paddingHorizontal: 40,
  },
  cameraControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 40,
  },
  cancelScanButton: {
    backgroundColor: 'rgba(244, 67, 54, 0.9)',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 25,
  },
  scanButton: {
    backgroundColor: 'rgba(76, 175, 80, 0.9)',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 25,
  },
  disabledScanButton: {
    backgroundColor: 'rgba(158, 158, 158, 0.9)',
  },
  controlButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Student Materials
  materialsHeader: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  materialsTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  materialsSubtitle: {
    fontSize: 16,
    color: '#666',
  },
  materialItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginVertical: 6,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  materialIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0f7ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  materialTypeIcon: {
    fontSize: 24,
  },
  materialContent: {
    flex: 1,
  },
  downloadButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1976D2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  downloadIcon: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },

  // Attendance History
  historyHeader: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  historyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  historySubtitle: {
    fontSize: 14,
    color: '#666',
  },
  historyFilters: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#f8f9fa',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  filterButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  activeFilterButton: {
    backgroundColor: '#1976D2',
    borderColor: '#1976D2',
  },
  filterButtonText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  activeFilterButtonText: {
    color: '#fff',
  },
  historyItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    alignItems: 'center',
  },
  historyDate: {
    width: 60,
    alignItems: 'center',
    marginRight: 16,
  },
  historyDay: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  historyMonth: {
    fontSize: 10,
    color: '#666',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  historyDetails: {
    flex: 1,
  },
  historyCourse: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  historyTime: {
    fontSize: 12,
    color: '#666',
  },
  historyStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 60,
    alignItems: 'center',
  },
  presentBadge: {
    backgroundColor: '#e8f5e8',
  },
  lateBadge: {
    backgroundColor: '#fff3e0',
  },
  absentBadge: {
    backgroundColor: '#ffebee',
  },
  historyStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  presentText: {
    color: '#4CAF50',
  },
  lateText: {
    color: '#FF9800',
  },
  absentText: {
    color: '#F44336',
  },

  // Empty States
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },

  // Error and Success States
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#1976D2',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  // Additional Platform-specific Styles
  ...Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
    android: {
      elevation: 2,
    },
  }),

  // Face Registration Styles
  faceRegistrationCard: {
    backgroundColor: '#fff3cd',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  faceRegistrationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#856404',
    marginBottom: 8,
  },
  faceRegistrationText: {
    fontSize: 14,
    color: '#856404',
    marginBottom: 12,
    lineHeight: 20,
  },
  faceRegistrationButton: {
    backgroundColor: '#ffc107',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  faceRegistrationButtonText: {
    color: '#212529',
    fontSize: 14,
    fontWeight: '600',
  },
  faceRegistrationModalContent: {
    flex: 1,
    padding: 20,
  },
  faceRegistrationInstructions: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },

  // Face Capture Section Styles
  faceCaptureSection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  faceCaptureFrame: {
    width: 200,
    height: 200,
    backgroundColor: '#f0f0f0',
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#ddd',
    borderStyle: 'dashed',
  },
  faceCaptureIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  faceCaptureText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  captureButton: {
    backgroundColor: '#1976D2',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 25,
    marginBottom: 24,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  captureButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Face Preview Section Styles
  facePreviewSection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  facePreviewContainer: {
    position: 'relative',
    marginBottom: 24,
  },
  facePreviewImage: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 3,
    borderColor: '#4CAF50',
  },
  facePreviewOverlay: {
    position: 'absolute',
    bottom: -10,
    left: 0,
    right: 0,
    backgroundColor: '#4CAF50',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignItems: 'center',
  },
  facePreviewText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  facePreviewActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 20,
  },
  retakeButton: {
    backgroundColor: '#f44336',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    flex: 0.45,
    alignItems: 'center',
  },
  retakeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  registerButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    flex: 0.45,
    alignItems: 'center',
  },
  registerButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  // Face Matching Animation Styles
  faceFrameMatching: {
    borderColor: '#4CAF50',
    borderWidth: 4,
    borderStyle: 'solid',
  },
  matchingAnimation: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -50 }, { translateY: -50 }],
    alignItems: 'center',
  },
  matchingIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(76, 175, 80, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  matchingEmoji: {
    fontSize: 24,
  },
  matchingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  matchingProgress: {
    width: 120,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  matchingProgressBar: {
    height: 4,
    backgroundColor: '#4CAF50',
    borderRadius: 2,
    width: '100%',
    // Add animation here if needed
  },

  // Info Section Styles
  infoSection: {
    backgroundColor: '#e3f2fd',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#2196f3',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1565c0',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#1565c0',
    lineHeight: 20,
  },
});