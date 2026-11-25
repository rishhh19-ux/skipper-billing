const express = require('express');
const router = express.Router();
const billController = require('../controllers/billController');

// Summary / stats endpoint (must be declared before :id)
router.get('/stats', billController.getStats);

// Printable invoice HTML
router.get('/:id/print', billController.getInvoiceHtml);

// CRUD routes
router.get('/', billController.getAllBills);
router.post('/', billController.createBill);
router.get('/:id', billController.getBillById);
router.put('/:id', billController.updateBill);
router.delete('/:id', billController.deleteBill);

module.exports = router;
