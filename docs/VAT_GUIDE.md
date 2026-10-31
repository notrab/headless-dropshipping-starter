# VAT Handling Guide

This guide explains how VAT is handled in the checkout process based on Printful's VAT rules and your configuration.

## Quick Start

The VAT behavior is controlled by environment variables in your `.env` file:

```env
# Set to true to pass VAT costs through to customers
# Set to false to absorb VAT as a business cost (default)
PASS_THROUGH_VAT=false

# Add your UK VAT number if registered (optional)
# UK_VAT_NUMBER=GB123456789
```

These are type-safe environment variables defined in `astro.config.mjs`.

## Printful's VAT Rules (UK)

### If You DON'T Have a UK VAT Number

**Orders fulfilled and shipped within UK:**
- Printful charges you 20% VAT on the total order
- This is always charged regardless of your settings

**Orders fulfilled outside UK, shipped to UK:**
- If product value < £135: Printful charges you 20% VAT
- If product value ≥ £135: Printful charges 0% VAT (customer pays on delivery)

### If You HAVE a UK VAT Number (submitted to Printful)

**Orders fulfilled and shipped within UK:**
- Printful still charges you 20% VAT (this is standard for domestic UK transactions)

**Orders fulfilled outside UK, shipped to UK:**
- Printful charges you 0% VAT
- You handle VAT yourself through your own VAT reporting

## Configuration Options

### Option 1: PASS_THROUGH_VAT = false (Absorb VAT)

**Best for:**
- You're not VAT registered
- You want simple, predictable pricing for customers
- You're willing to accept lower profit margins on VAT-applicable orders

**How it works:**
- Customer sees and pays: Your retail prices + shipping (e.g., £93.50)
- Printful charges you: Retail prices + shipping + VAT (e.g., £117.86)
- You absorb: The VAT cost (e.g., £19.64)

**Example:**
```
Customer pays:     £93.50  (your marked-up prices + shipping)
Printful charges:  £117.86 (includes £19.64 VAT)
Your net:          -£24.36 (you lose the VAT amount)
```

**Validation:**
- System validates customer is paying ≥ `retail_costs.total`
- Allows overpayment (extra profit for you)
- Rejects if customer pays less than retail costs

### Option 2: PASS_THROUGH_VAT = true (Charge VAT)

**Best for:**
- You're VAT registered
- You want to maintain profit margins
- You're comfortable with dynamic pricing based on customer location

**How it works:**
- Customer sees and pays: Your retail prices + shipping + VAT (e.g., £117.86)
- Printful charges you: Same amount (e.g., £117.86)
- You absorb: Nothing - VAT is passed through

**Example:**
```
Customer pays:     £117.86 (includes £19.64 VAT)
Printful charges:  £117.86 (includes £19.64 VAT)
Your net:          £0 VAT impact (your markup is your profit)
```

**Validation:**
- System validates customer is paying ≥ `costs.total`
- Allows overpayment (extra profit for you)
- Rejects if customer pays less than full costs including VAT

## Setting Your UK VAT Number

If you're VAT registered in the UK:

1. **In Printful Dashboard:**
   - Go to Settings → Billing
   - Add your UK VAT number (e.g., "GB123456789")

2. **In Your Code:**
   ```typescript
   // src/config/tax.ts
   export const UK_VAT_NUMBER = "GB123456789";
   ```

3. **Effect:**
   - Printful won't charge VAT on imports (orders fulfilled outside UK)
   - You handle VAT reporting yourself
   - Orders fulfilled within UK still have VAT charged by Printful

## Payment Flow

1. **Customer adds items to cart**
   - Sees retail prices (your markup)

2. **Customer proceeds to checkout**
   - Enters shipping address
   - Selects shipping method
   - Frontend calculates total based on retail prices

3. **Validation happens (server-side)**
   - System calls Printful estimate endpoint
   - Gets both `retail_costs` and `costs` (with VAT)
   - Validates based on `PASS_THROUGH_VAT` setting
   - Updates Stripe payment intent with correct amount

4. **Customer confirms payment**
   - If `PASS_THROUGH_VAT = true`: May see updated total if VAT applies
   - If `PASS_THROUGH_VAT = false`: Sees original retail total

5. **Webhook creates Printful order**
   - After successful payment
   - Uses validated order details from payment intent metadata

## Example Scenarios

### Scenario 1: UK Customer, Not VAT Registered

**Configuration:**
```typescript
PASS_THROUGH_VAT = false
UK_VAT_NUMBER = null
```

**Order (fulfilled in UK):**
- Product: £70.00
- Shipping: £13.88
- Subtotal: £83.88
- VAT (20%): £16.78
- Total from Printful: £100.66

**Customer pays:** £83.88
**You pay Printful:** £100.66
**You absorb:** £16.78 VAT

### Scenario 2: UK Customer, VAT Registered, Pass Through

**Configuration:**
```typescript
PASS_THROUGH_VAT = true
UK_VAT_NUMBER = "GB123456789"
```

**Order (fulfilled in UK):**
- Product: £70.00
- Shipping: £13.88
- Subtotal: £83.88
- VAT (20%): £16.78
- Total from Printful: £100.66

**Customer pays:** £100.66 (including VAT)
**You pay Printful:** £100.66
**You absorb:** £0 (customer pays the VAT)

### Scenario 3: UK Customer, Import Order, VAT Registered

**Configuration:**
```typescript
PASS_THROUGH_VAT = true
UK_VAT_NUMBER = "GB123456789"
```

**Order (fulfilled outside UK, < £135):**
- Product: £70.00
- Shipping: £13.88
- Subtotal: £83.88
- VAT: £0 (you have VAT number)
- Total from Printful: £83.88

**Customer pays:** £83.88
**You pay Printful:** £83.88
**You handle:** VAT reporting yourself

## Troubleshooting

### "Order total validation failed"

This error occurs when the customer is paying less than the minimum required:

- If `PASS_THROUGH_VAT = false`: Customer paying < retail_costs.total
- If `PASS_THROUGH_VAT = true`: Customer paying < costs.total

**Common causes:**
1. Outdated cart totals (user needs to refresh)
2. Price changed between cart and checkout
3. Shipping rate changed
4. Currency conversion issues

**Solution:**
- Ask customer to refresh and try again
- Clear cart and re-add items
- Check for price/shipping updates

### VAT amount seems wrong

**Check:**
1. Is your UK VAT number set in Printful Dashboard?
2. Does `UK_VAT_NUMBER` in code match Printful Dashboard?
3. Is order being fulfilled in UK or imported?
4. Is product value above/below £135 threshold?

### Customer sees different total at payment

This is expected if `PASS_THROUGH_VAT = true` and:
- Cart calculated without VAT
- Validation endpoint added VAT
- Payment intent amount was updated

**Solution:**
- Frontend should update UI after validation response
- Show breakdown: Subtotal, Shipping, VAT, Total

## Recommendations

### If You're NOT VAT Registered

```env
PASS_THROUGH_VAT=false
# UK_VAT_NUMBER not set
```

**Pros:**
- Simple, predictable pricing for customers
- No VAT reporting requirements

**Cons:**
- Lower profit margins on UK orders
- You absorb VAT costs

### If You ARE VAT Registered

```env
PASS_THROUGH_VAT=true
UK_VAT_NUMBER=GB123456789
```

**Pros:**
- Maintain full profit margins
- VAT costs passed to customer
- Proper VAT reporting

**Cons:**
- Slightly more complex for customers
- Must handle VAT reporting yourself

## Further Reading

- [Printful VAT Guide](https://help.printful.com/hc/en-us/articles/360014066200)
- [UK VAT Registration](https://www.gov.uk/vat-registration)
- [Stripe Payment Intents](https://stripe.com/docs/payments/payment-intents)
