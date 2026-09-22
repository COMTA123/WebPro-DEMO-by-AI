document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('.payment-form').forEach(function (form) {
    form.addEventListener('submit', function (event) {
      const employee = form.querySelector('[name="emp_id"]');

      if (!employee || !employee.value) {
        event.preventDefault();
        alert('กรุณาเลือก Cashier');
        return;
      }

      if (!confirm('ยืนยันว่าได้รับชำระเงินแล้ว?')) {
        event.preventDefault();
      }
    });
  });
});
