const mongoose = require('mongoose');

const billItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Item name is required'],
    trim: true,
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [1, 'Quantity must be at least 1'],
    default: 1,
  },
  unitPrice: {
    type: Number,
    required: [true, 'Unit price is required'],
    min: [0, 'Unit price cannot be negative'],
  },
  discount: {
    type: Number,
    default: 0,
    min: [0, 'Discount cannot be negative'],
  },
  total: {
    type: Number,
    required: true,
  },
});

const billSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    customer: {
      name: {
        type: String,
        required: [true, 'Customer name is required'],
        trim: true,
      },
      phone: {
        type: String,
        trim: true,
        default: '',
      },
      email: {
        type: String,
        trim: true,
        default: '',
      },
      address: {
        type: String,
        trim: true,
        default: '',
      },
    },
    items: {
      type: [billItemSchema],
      validate: {
        validator: function (items) {
          return items && items.length > 0;
        },
        message: 'A bill must have at least one item',
      },
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    taxRate: {
      type: Number,
      default: 0, // percentage e.g. 5, 12, 18
      min: 0,
    },
    taxAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0, // overall bill discount
      min: 0,
    },
    grandTotal: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentMethod: {
      type: String,
      enum: ['Cash', 'Card', 'UPI', 'Bank Transfer', 'Credit'],
      default: 'Cash',
    },
    status: {
      type: String,
      enum: ['paid', 'pending', 'cancelled'],
      default: 'paid',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Create compound search index
billSchema.index({ 'customer.name': 'text', invoiceNumber: 'text' });

module.exports = mongoose.model('Bill', billSchema);
