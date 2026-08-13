import { BaseRepository } from './base.repository.js';

export interface PaymentRecord {
    id?: string;
    user_id?: string;
    paypal_order_id?: string;
    status?: string;
    credits_granted?: boolean;
    plan_type?: string;
    plan_started_at?: string;
    plan_ends_at?: string;
    payer_name?: string;
    created_at?: string;
    updated_at?: string;
    [key: string]: unknown;
}

export class PaymentRepository extends BaseRepository<PaymentRecord> {
    constructor() {
        super('payment_details');
    }

    async findByUserId(userId: string): Promise<PaymentRecord[]> {
        return this.findMany(
            { user_id: userId } as Partial<PaymentRecord>,
            { orderBy: 'created_at', orderDirection: 'desc' },
        );
    }

    async findByPayPalOrderId(orderId: string): Promise<PaymentRecord | null> {
        return this.findOne({ paypal_order_id: orderId } as Partial<PaymentRecord>);
    }
}

export const paymentRepository = new PaymentRepository();