import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './contexts/AppContext';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { ProtectedLayout } from './components/Layout';
import { LoginPage, RegisterPage } from './pages/AuthPages';
import { Dashboard } from './pages/Dashboard';
import { UploadMaterials } from './pages/UploadMaterials';
import { WeeklyPlan } from './pages/WeeklyPlan';
import { ExamPreparation } from './pages/ExamPreparation';
import { StudyGuide } from './pages/StudyGuide';
import { QuestionGenerator } from './pages/QuestionGenerator';
import { PracticeMode } from './pages/PracticeMode';
import { QuestionLibrary } from './pages/QuestionLibrary';
import { Children } from './pages/Children';
import { AIAssistant } from './pages/AIAssistant';
import { Settings } from './pages/Settings';

export default function App() {
  return (
    <ThemeProvider>
      <SettingsProvider>
      <AuthProvider>
        <AppProvider>
          <BrowserRouter basename="/SchoolBuddy">
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              {/* Protected routes — wrapped in ProtectedLayout */}
              <Route path="/" element={<ProtectedLayout><Dashboard /></ProtectedLayout>} />
              <Route path="/upload" element={<ProtectedLayout><UploadMaterials /></ProtectedLayout>} />
              <Route path="/weekly-plan" element={<ProtectedLayout><WeeklyPlan /></ProtectedLayout>} />
              <Route path="/exam-prep" element={<ProtectedLayout><ExamPreparation /></ProtectedLayout>} />
              <Route path="/study-guide" element={<ProtectedLayout><StudyGuide /></ProtectedLayout>} />
              <Route path="/question-generator" element={<ProtectedLayout><QuestionGenerator /></ProtectedLayout>} />
              <Route path="/practice" element={<ProtectedLayout><PracticeMode /></ProtectedLayout>} />
              <Route path="/library" element={<ProtectedLayout><QuestionLibrary /></ProtectedLayout>} />
              <Route path="/children" element={<ProtectedLayout><Children /></ProtectedLayout>} />
              <Route path="/assistant" element={<ProtectedLayout><AIAssistant /></ProtectedLayout>} />
              <Route path="/settings" element={<ProtectedLayout><Settings /></ProtectedLayout>} />

              {/* Catch-all */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </AppProvider>
      </AuthProvider>
      </SettingsProvider>
    </ThemeProvider>
  );
}
