export type OrderStatus =
  | "pending"
  | "confirmed"
  | "cancelled";

export interface CreateOrderInput {
  userId: string;
  items: {
    productId: string;
    quantity: number;
  }[];
}

export interface Order {
  id: string;
  userId: string;
  total: number;
  status: OrderStatus;
}