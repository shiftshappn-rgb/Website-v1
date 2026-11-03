import { PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { forwardRef, useImperativeHandle, useState } from "react";

export type StripePaymentSectionHandle = {
  confirm: () => Promise<{ paymentIntentId: string } | { error: string }>;
};

export const StripePaymentSection = forwardRef<StripePaymentSectionHandle>(
  function StripePaymentSection(_, ref) {
    const stripe = useStripe();
    const elements = useElements();
    const [ready, setReady] = useState(false);

    useImperativeHandle(ref, () => ({
      async confirm() {
        if (!stripe || !elements) {
          return { error: "Payment form is still loading. Please wait." };
        }

        const { error, paymentIntent } = await stripe.confirmPayment({
          elements,
          redirect: "if_required",
          confirmParams: {
            return_url: `${window.location.origin}/checkout/payment`,
          },
        });

        if (error) {
          return { error: error.message || "Payment failed. Please try again." };
        }

        if (!paymentIntent || paymentIntent.status !== "succeeded") {
          return {
            error: "Payment was not completed. Please try again or use another card.",
          };
        }

        return { paymentIntentId: paymentIntent.id };
      },
    }));

    return (
      <div className={ready ? "" : "min-h-[180px]"}>
        <PaymentElement
          onReady={() => setReady(true)}
          options={{
            layout: "tabs",
          }}
        />
      </div>
    );
  }
);
