-- Check for constraints on payment_details
SELECT conname, contype, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.payment_details'::regclass;

-- Check recent payments to see duplicates
SELECT id, created_at, paypal_order_id, status
FROM public.payment_details
ORDER BY created_at DESC
LIMIT 10;
