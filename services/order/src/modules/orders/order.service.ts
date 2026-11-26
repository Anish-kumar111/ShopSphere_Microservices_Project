import {
  validate,
  HttpError
} from "@shopsphere/service-kit";

import { createOrderSchema } from "./orders.schema.js";

export async function createOrder(input: unknown) {

  const data = validate(createOrderSchema, input);

  if (data.quantity > 100) {
    throw new HttpError(400, "Invalid quantity", {
      detail: "Maximum order quantity is 100",
    });
  }

  // data is now fully typed
  console.log(data.userId);
  console.log(data.productId);
  console.log(data.quantity);
}