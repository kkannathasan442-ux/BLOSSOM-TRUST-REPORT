const express = require('express');
const router = express.Router();

// Middlewares
const { verifyToken, isAdmin } = require('../middleware/auth');
const uploadImage = require('../middleware/uploadImage');
const uploadExcel = require('../middleware/uploadExcel');
// Controllers
const authController = require('../controllers/authController');
const studentController = require('../controllers/studentController');
const adminController = require('../controllers/adminController');
const reportController = require('../controllers/reportController');
const importController = require('../controllers/importController');
const attendanceController = require('../controllers/attendanceController');
const employmentController = require('../controllers/employmentController');
const fundingController = require('../controllers/fundingController');
const uploadAttendance = require('../middleware/uploadAttendance');

// Middleware to prevent browser and proxy caching on dynamic API endpoints
const preventCaching = (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
};

router.use(preventCaching);

// 1. Auth Routes
router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);
router.get('/auth/me', verifyToken, authController.me);

// 2. Student Routes
router.get('/student/profile', verifyToken, studentController.getProfile);
router.put('/student/profile', verifyToken, studentController.updateProfile);
router.post('/student/photo', verifyToken, uploadImage.single('photo'), studentController.uploadPhoto);
router.post('/student/request-edit', verifyToken, studentController.requestEdit);

// Public Settings Route (for frontend column labels)
router.get('/settings', verifyToken, adminController.getPublicSettings);

// 3. Admin Routes (Protected by verifyToken & isAdmin)
router.get('/admin/stats', verifyToken, isAdmin, adminController.getStats);
router.get('/admin/stats/analytics', verifyToken, isAdmin, adminController.getAnalyticsStats);
router.get('/admin/students', verifyToken, isAdmin, adminController.listStudents);
router.get('/admin/students/:id', verifyToken, isAdmin, adminController.getStudentDetail);
router.put('/admin/students/:id/admin-fields', verifyToken, isAdmin, adminController.updateAdminColumns);
router.post('/admin/students/:id/approve', verifyToken, isAdmin, adminController.approveProfile);
router.post('/admin/students/:id/reject', verifyToken, isAdmin, adminController.rejectProfile);

router.get('/admin/settings', verifyToken, isAdmin, adminController.getSettings);
router.put('/admin/settings', verifyToken, isAdmin, adminController.updateSettings);

router.get('/admin/edit-requests', verifyToken, isAdmin, adminController.getEditRequests);
router.post('/admin/edit-requests/:id/approve', verifyToken, isAdmin, adminController.approveEditRequest);
router.post('/admin/edit-requests/:id/reject', verifyToken, isAdmin, adminController.rejectEditRequest);

router.post('/admin/sync-sheets', verifyToken, isAdmin, adminController.syncGoogleSheets);
router.get('/admin/import/sample', verifyToken, isAdmin, importController.downloadSample);
router.post('/admin/import', verifyToken, isAdmin, uploadExcel.single('excel'), importController.importExcel);
router.post('/admin/attendance/upload', verifyToken, isAdmin, uploadAttendance.single('attendanceFile'), attendanceController.uploadAttendance);
router.post('/admin/attendance/manual', verifyToken, isAdmin, attendanceController.manualEntry);
router.get('/admin/attendance/history', verifyToken, isAdmin, attendanceController.getHistory);
router.post('/admin/attendance/clear', verifyToken, isAdmin, attendanceController.clearAttendance);

router.post('/admin/employment', verifyToken, isAdmin, employmentController.addEmployment);
router.get('/admin/employment/history', verifyToken, isAdmin, employmentController.getEmploymentHistory);

router.post('/admin/funding', verifyToken, isAdmin, fundingController.addPayment);
router.get('/admin/funding/history', verifyToken, isAdmin, fundingController.getPaymentHistory);

// 4. Admin Reports Routes
router.get('/admin/reports/blossom-final', verifyToken, isAdmin, reportController.blossomFinalReport);
router.get('/admin/reports/non-blossom', verifyToken, isAdmin, reportController.nonBlossomReport);
router.get('/admin/reports/employment', verifyToken, isAdmin, reportController.employmentReport);
router.get('/admin/reports/dropout', verifyToken, isAdmin, reportController.dropoutReport);
router.get('/admin/reports/attendance', verifyToken, isAdmin, reportController.monthlyAttendanceReport);

module.exports = router;
