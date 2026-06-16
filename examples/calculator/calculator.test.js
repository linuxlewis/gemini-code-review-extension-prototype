import { strict as assert } from "node:assert";
import { calculateDiscountedTotal, normalizeLineItems } from "./calculator.js";

const total = calculateDiscountedTotal(
  [
    { price: 10, quantity: 2 },
    { price: 5, quantity: 1 },
  ],
  10,
);

assert.equal(total, 22.5);

assert.deepEqual(normalizeLineItems([{ price: 7 }]), [{ price: 7, quantity: 1 }]);
