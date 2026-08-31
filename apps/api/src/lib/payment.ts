import Razorpay from 'razorpay'; import crypto from 'node:crypto';
const client=(process.env.RAZORPAY_KEY_ID&&process.env.RAZORPAY_KEY_SECRET)?new Razorpay({key_id:process.env.RAZORPAY_KEY_ID,key_secret:process.env.RAZORPAY_KEY_SECRET}):null;
export async function createRazorpayOrder(amount:number,receipt:string){if(!client) throw new Error('Razorpay is not configured');return client.orders.create({amount,currency:'INR',receipt,payment_capture:true})}
export function verifyPaymentSignature(orderId:string,paymentId:string,signature:string){const expected=crypto.createHmac('sha256',process.env.RAZORPAY_KEY_SECRET||'').update(`${orderId}|${paymentId}`).digest('hex');return crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(signature))}
export function verifyWebhookSignature(body:string,signature:string){const expected=crypto.createHmac('sha256',process.env.RAZORPAY_WEBHOOK_SECRET||'').update(body).digest('hex');return signature===expected}
