document.addEventListener('DOMContentLoaded', function () {
  const hasFocusedControl = function () {
    return ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON']
      .includes(document.activeElement.tagName);
  };

  setInterval(function () {
    if (!hasFocusedControl()) {
      window.location.reload();
    }
  }, 15000);
});
