document.addEventListener('DOMContentLoaded', function () {
  const quantity = document.querySelector('#quantity');
  const minus = document.querySelector('.quantity-minus');
  const plus = document.querySelector('.quantity-plus');
  const addButton = document.querySelector('#addButton');
  const priceText = document.querySelector('#calculatedPrice');
  const optionCheckboxes = document.querySelectorAll('.option-checkbox');

  function calculatePrice() {
    if (!quantity || !addButton || !priceText) return;

    let unitPrice = Number(addButton.dataset.basePrice || 0);

    optionCheckboxes.forEach(function (checkbox) {
      if (checkbox.checked) {
        unitPrice += Number(checkbox.dataset.extra || 0);
      }
    });

    const qty = Math.max(1, Number(quantity.value || 1));
    priceText.textContent = (unitPrice * qty).toFixed(2);
  }

  if (minus) {
    minus.addEventListener('click', function () {
      quantity.value = Math.max(1, Number(quantity.value || 1) - 1);
      calculatePrice();
    });
  }

  if (plus) {
    plus.addEventListener('click', function () {
      quantity.value = Math.min(99, Number(quantity.value || 1) + 1);
      calculatePrice();
    });
  }

  if (quantity) quantity.addEventListener('input', calculatePrice);
  optionCheckboxes.forEach(function (checkbox) {
    checkbox.addEventListener('change', calculatePrice);
  });

  const paymentMethods = document.querySelectorAll('.payment-method');
  const qrPanel = document.querySelector('#qrPaymentPanel');

  function toggleQrPanel() {
    if (!qrPanel) return;

    const selected = document.querySelector(
      '.payment-method[name="payment_method"]:checked'
    );

    qrPanel.classList.toggle(
      'd-none',
      !selected || selected.value !== 'qr_payment'
    );
  }

  paymentMethods.forEach(function (radio) {
    radio.addEventListener('change', toggleQrPanel);
  });

  toggleQrPanel();

  const statusPage = document.querySelector('#orderStatusPage');

  function renderProgress(status) {
    const order = ['pending', 'preparing', 'ready', 'completed'];
    const currentIndex = order.indexOf(status);

    document.querySelectorAll('.progress-step').forEach(function (element) {
      const index = order.indexOf(element.dataset.step);
      element.classList.toggle(
        'done',
        currentIndex >= index && currentIndex >= 0
      );
    });
  }

  if (statusPage) {
    const orderId = statusPage.dataset.orderId;
    const initialStatus = document
      .querySelector('.progress-steps')
      .dataset.current;

    renderProgress(initialStatus);

    setInterval(async function () {
      try {
        const response = await fetch(
          '/customer/orders/' + orderId + '/status',
          { headers: { Accept: 'application/json' } }
        );

        if (!response.ok) return;

        const data = await response.json();
        const orderText = document.querySelector('#orderStatusText');
        const orderSummary = document.querySelector('#orderStatusSummary');
        const paymentText = document.querySelector('#paymentStatusText');

        orderText.textContent = data.orderStatus;
        orderText.className = 'status-pill status-' + data.orderStatus;
        orderSummary.textContent = data.orderStatus;
        paymentText.textContent = data.paymentStatus;
        renderProgress(data.orderStatus);
      } catch (_) {
        // Keep the page usable if polling temporarily fails.
      }
    }, 10000);
  }
});
