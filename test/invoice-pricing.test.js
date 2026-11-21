'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

test('pricing applies the HSN slab to the full line, then splits GST', function () {
  var totals = pricing.computeTotals([
    { id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 2 }
  ], '');

  assert.deepEqual(totals, {
    subtotal: 200,
    discount: 0,
    taxable: 200,
    tax: 10,
    cgst: 5,
    sgst: 5,
    total: 210,
    lines: [{
      id: 1, name: 'Rice', hsn: '1006', gstPercent: 5,
      gross: 200, discount: 0, taxable: 200, tax: 10, net: 210
    }]
  });
});

test('invoice uses the same HSN and explicit GST rates as order pricing', function () {
  var result = invoice.computeInvoiceFigures({ items: [
    { name: 'Explicit rate', price: 100, qty: 1, gstRate: 0.05 },
    { name: 'HSN only', price: 100, qty: 1, hsn: '1006' }
  ] });

  assert.deepEqual(result, {
    subtotal: 200,
    discount: 0,
    tax: 10,
    cgst: 5,
    sgst: 5,
    total: 210,
    rows: [
      { name: 'Explicit rate', sku: '-', hsn: '-', qty: 1, price: 100, gstPercent: 5, line: 100, lineTax: 5 },
      { name: 'HSN only', sku: '-', hsn: '1006', qty: 1, price: 100, gstPercent: 5, line: 100, lineTax: 5 }
    ]
  });
});

test('invoice coupon totals match the amount billed by order pricing', function () {
  var items = [{ id: 2, name: 'Rice', hsn: '1006', price: 100, qty: 10 }];
  var ledgerTotals = pricing.computeTotals(items, 'SAVE10');
  var invoiceTotals = invoice.computeInvoiceFigures({ items: items, coupon: 'SAVE10' });

  assert.equal(ledgerTotals.discount, 100);
  assert.equal(ledgerTotals.tax, 45);
  assert.equal(ledgerTotals.total, 945);
  assert.equal(invoiceTotals.discount, 100);
  assert.equal(invoiceTotals.tax, 45);
  assert.equal(invoiceTotals.total, 945);
});

test('reconciliation matches an in-memory order billed using its HSN slab', function () {
  var db = {
    orders: [{
      id: 7,
      date: '2021-11-01',
      customer: 'In-memory customer',
      items: [{ id: 3, name: 'Rice', hsn: '1006', price: 100, qty: 1 }],
      coupon: '',
      subtotal: 100,
      discount: 0,
      tax: 5,
      total: 105
    }],
    products: [],
    customers: []
  };

  assert.deepEqual(reports.getGstReconciliation(db), {
    totalChecked: 1,
    mismatchCount: 0,
    totalDelta: 0,
    rows: [{
      orderId: 7,
      date: '2021-11-01',
      customer: 'In-memory customer',
      coupon: '',
      ledgerSubtotal: 100,
      ledgerDiscount: 0,
      ledgerTax: 5,
      ledgerTotal: 105,
      invoiceDiscount: 0,
      invoiceTax: 5,
      invoiceTotal: 105,
      delta: 0,
      matched: true
    }]
  });
});
