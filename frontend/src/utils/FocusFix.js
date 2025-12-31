// frontend/src/utils/FocusFix.jsx
import { useEffect } from 'react';

export const useFocusFix = () => {
  useEffect(() => {
    const handleInputFocus = () => {
      // Store the currently focused element
      const activeElement = document.activeElement;
      
      // If it's an input/textarea, make sure it stays focusable
      if (activeElement && (activeElement.tagName === 'INPUT' || 
                            activeElement.tagName === 'TEXTAREA' || 
                            activeElement.tagName === 'SELECT')) {
        
        // Add a class to mark it as manually focused
        activeElement.classList.add('electron-focus-fixed');
        
        // Ensure it's selectable
        activeElement.style.userSelect = 'text';
        activeElement.style.cursor = 'text';
        
        // Re-focus if needed
        setTimeout(() => {
          if (document.activeElement !== activeElement) {
            activeElement.focus();
            activeElement.select();
          }
        }, 50);
      }
    };

    // Listen for focus events
    document.addEventListener('focusin', handleInputFocus);
    
    // Also handle window focus events
    const handleWindowFocus = () => {
      setTimeout(() => {
        const inputs = document.querySelectorAll('input, textarea, select');
        inputs.forEach(input => {
          input.style.userSelect = 'text';
          input.style.cursor = 'text';
        });
      }, 100);
    };

    window.addEventListener('focus', handleWindowFocus);
    
    // Initial fix
    handleWindowFocus();

    return () => {
      document.removeEventListener('focusin', handleInputFocus);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, []);
};

// Component wrapper
export default function FocusFix({ children }) {
  useFocusFix();
  return children;
}