import { useState } from 'react';
import CourseManagement from './pages/CourseManagement';
import StudentRegistration from './pages/StudentRegistration';
import AllocationDashboard from './pages/AllocationDashboard';
import DatasetAssistant from './pages/DatasetAssistant';

const TABS = [
  { id: 'courses', label: 'Task 1: Courses', component: CourseManagement },
  { id: 'students', label: 'Task 1: Students', component: StudentRegistration },
  { id: 'allocation', label: 'Task 1: Allocation & AI', component: AllocationDashboard },
  { id: 'datasets', label: 'Task 2: AI SQL Assistant', component: DatasetAssistant },
];

export default function App() {
  const [active, setActive] = useState('courses');
  const ActiveComponent = TABS.find((t) => t.id === active).component;

  return (
    <div className="app-shell">
      <h1>Harvee Designs — Full Stack Assessment</h1>
      <p style={{ color: '#666', marginTop: -8 }}>
        Task 1: AI-Powered Student Course Allocation System &nbsp;|&nbsp; Task 2: AI SQL Assistant
      </p>
      <div className="navbar">
        {TABS.map((t) => (
          <button key={t.id} className={active === t.id ? 'active' : ''} onClick={() => setActive(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <ActiveComponent />
    </div>
  );
}

