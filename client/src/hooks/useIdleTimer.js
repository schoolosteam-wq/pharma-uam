import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const IDLE_TIME = 15 * 60 * 1000; // 15 minutes

export const useIdleTimer = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    let timer;

    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        logout();
        localStorage.removeItem('selectedFacility');
        navigate('/login');
      }, IDLE_TIME);
    };

    const events = ['mousemove', 'keydown', 'click', 'scroll'];
    events.forEach(event => window.addEventListener(event, resetTimer));

    resetTimer(); // start

    return () => {
      clearTimeout(timer);
      events.forEach(event => window.removeEventListener(event, resetTimer));
    };
  }, [logout, navigate]);
};