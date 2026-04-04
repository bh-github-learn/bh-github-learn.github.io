// Newspaper Theme - Dark Mode Sync Enhancement
// This script enhances dark mode synchronization between pages

document.addEventListener('DOMContentLoaded', function() {
  // Get the dark mode toggle button
  const darkModeToggle = document.querySelector('.dark-mode-toggle');
  if (!darkModeToggle) return;

  // 确保暗色模式类正确地应用到body元素
  function syncDarkModeClasses() {
    const htmlHasDarkMode = document.documentElement.classList.contains('dark-mode');
    const bodyHasDarkMode = document.body.classList.contains('dark-mode');

    if (htmlHasDarkMode && !bodyHasDarkMode) {
      document.body.classList.add('dark-mode');
    } else if (!htmlHasDarkMode && bodyHasDarkMode) {
      document.documentElement.classList.add('dark-mode');
    }
  }

  syncDarkModeClasses();

  // 我们不 clone 节点覆盖绑定的事件，而是直接补充逻辑：
  darkModeToggle.addEventListener('click', function() {
    const isDarkMode = document.body.classList.contains('dark-mode');
    
    // 同步给 html (由于 main.js 中已经 toggle 了 body.dark-mode)
    if (isDarkMode) {
      document.documentElement.classList.add('dark-mode');
    } else {
      document.documentElement.classList.remove('dark-mode');
    }

    const themeChangeEvent = new CustomEvent('themeChange', {
      detail: { isDarkMode: isDarkMode }
    });
    window.dispatchEvent(themeChangeEvent);
  });

  // Listen for theme change events from other pages/components
  window.addEventListener('themeChange', function(e) {
    const isDarkMode = e.detail.isDarkMode;
    const currentlyDarkMode = document.body.classList.contains('dark-mode');

    if (isDarkMode !== currentlyDarkMode) {
      // 同时应用到html和body元素
      if (isDarkMode) {
        document.documentElement.classList.add('dark-mode');
        document.body.classList.add('dark-mode');
      } else {
        document.documentElement.classList.remove('dark-mode');
        document.body.classList.remove('dark-mode');
      }

      darkModeToggle.innerHTML = isDarkMode ? '☀️' : '🌙';
      localStorage.setItem('darkMode', isDarkMode);
    }
  });

  // Listen for storage changes to sync theme across tabs
  window.addEventListener('storage', function(e) {
    if (e.key === 'darkMode') {
      const isDarkMode = e.newValue === 'true';
      const currentlyDarkMode = document.body.classList.contains('dark-mode');

      if (isDarkMode !== currentlyDarkMode) {
        // 同时应用到html和body元素
        if (isDarkMode) {
          document.documentElement.classList.add('dark-mode');
          document.body.classList.add('dark-mode');
        } else {
          document.documentElement.classList.remove('dark-mode');
          document.body.classList.remove('dark-mode');
        }

        darkModeToggle.innerHTML = isDarkMode ? '☀️' : '🌙';
      }
    }
  });

  // 监听页面显示事件，确保暗色模式类正确同步
  document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
      syncDarkModeClasses();
    }
  });

  // 监听页面获得焦点事件，确保暗色模式类正确同步
  window.addEventListener('focus', function() {
    syncDarkModeClasses();
  });
});