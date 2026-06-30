import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import OAuthCallback from './pages/OAuthCallback';
import DashboardLayout from './components/layout/DashboardLayout';
import StudentHome from './pages/dashboard/StudentHome';
import Conversations from './pages/dashboard/Conversations';
import Lectures from './pages/dashboard/Lectures';
import Slides from './pages/dashboard/Slides';
import ClassData from './pages/dashboard/ClassData';
import Archive from './pages/dashboard/Archive';
import TeacherInteraction from './pages/dashboard/TeacherInteraction';
import SubjectSelection from './pages/dashboard/SubjectSelection';
import StudentAnalytics from './pages/dashboard/StudentAnalytics';
import Voices from './pages/dashboard/Voices';
import CloneStudio from './pages/dashboard/CloneStudio';
import { useAuth } from './context/AuthContext';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) return <div className="loading-screen">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  
  return children;
};

// Public Only Route (Redirect to dashboard if already logged in)
const PublicOnlyRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  
  return children;
};

// Dynamic dashboard index based on user role
const DashboardIndex = () => {
  const { role } = useAuth();
  if (role === 'teacher' || role === 'admin') {
    return <ClassData />;
  }
  return <StudentHome />;
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={
            <PublicOnlyRoute>
              <Login />
            </PublicOnlyRoute>
          } 
        />

        {/* OAuth callback — must be public, user is mid-authentication */}
        <Route path="/auth/callback" element={<OAuthCallback />} />
        
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardIndex />} />
          <Route path="subjects" element={<SubjectSelection />} />
          <Route path="interaction" element={<TeacherInteraction />} />
          <Route path="conversations" element={<Conversations />} />
          <Route path="lectures" element={<Lectures />} />
          <Route path="slides" element={<Slides />} />
          <Route path="data" element={<ClassData />} />
          <Route path="analytics" element={<StudentAnalytics />} />
          <Route path="archive" element={<Archive />} />
          <Route path="voices" element={<Voices />} />
          <Route path="clone-studio" element={<CloneStudio />} />
        </Route>

        {/* Redirect root based on auth status is handled by the routes above */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
