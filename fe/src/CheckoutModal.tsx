import { useEffect, useRef, useState } from "react";
import { EmbeddedCheckout } from "@henrylabs-interview/payments";
import type { CartItem } from "./App";
import { formatPrice } from "./App";

type Step = "idle" | "creating" | "payment" | "confirming" | "success" | "error";

interface CheckoutModalProps {
  cart: CartItem[];
  cartCurrency: string;
  totalAmount: number;
  onClose: () => void;
  onSuccess: () => void;
  showToast: (message: string, type: "success" | "error") => void;
}

export default function CheckoutModal({
  cart,
  cartCurrency,
  totalAmount,
  onClose,
  onSuccess,
  showToast,
}: CheckoutModalProps) {
  const [step, setStep] = useState<Step>("idle");
  const [checkoutId, setCheckoutId] = useState<string | null>(null);
  const [confirmationId, setConfirmationId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const renderedRef = useRef(false);

  async function handlePay() {
    setStep("creating");
    try {
      const res = await fetch("http://localhost:3000/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: totalAmount,
          currency: cartCurrency,
          customerId: "cust_demo_001",
        }),
      });
      const data = await res.json();

      if (data.status === "success" && data.data?.checkoutId) {
        setCheckoutId(data.data.checkoutId);
        setStep("payment");
      } else {
        setErrorMessage(data.message || "Failed to create checkout");
        setStep("error");
      }
    } catch {
      setErrorMessage("Network error — please try again");
      setStep("error");
    }
  }

  useEffect(() => {
    if (step !== "payment" || !checkoutId || renderedRef.current) return;
    renderedRef.current = true;

    const ec = new EmbeddedCheckout({ checkoutId });
    ec.render("embedded-checkout-container", async (paymentToken: string) => {
      setStep("confirming");
      try {
        const res = await fetch("http://localhost:3000/checkout/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            checkoutId,
            type: "embedded",
            data: { paymentToken },
          }),
        });
        const data = await res.json();

        if (data.status === "success") {
          setConfirmationId(data.data?.confirmationId || checkoutId);
          setStep("success");
        } else if (data.substatus === "502-fraud") {
          setErrorMessage("Payment could not be processed. Please try a different card.");
          setStep("error");
        } else {
          setErrorMessage(data.message || "Payment confirmation failed");
          setStep("error");
        }
      } catch {
        setErrorMessage("Network error — please try again");
        setStep("error");
      }
    });
  }, [step, checkoutId]);

  function handleDone() {
    onSuccess();
    showToast("Payment successful!", "success");
    onClose();
  }

  function handleRetry() {
    setStep("idle");
    setCheckoutId(null);
    setErrorMessage("");
    renderedRef.current = false;
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <span style={styles.modalTitle}>
            {step === "success" ? "Payment Complete" : "Checkout"}
          </span>
          <button style={styles.closeButton} onClick={onClose} aria-label="Cancel checkout">
            &times;
          </button>
        </div>

        <div style={styles.modalBody}>
          {/* Order summary — shown in idle and payment steps */}
          {(step === "idle" || step === "payment") && (
            <div style={styles.summary}>
              {cart.map((item) => (
                <div key={item.product.id} style={styles.summaryRow}>
                  <span style={styles.summaryName}>
                    {item.product.name} &times; {item.quantity}
                  </span>
                  <span style={styles.summaryPrice}>
                    {formatPrice(
                      (item.product.amount * item.quantity),
                      item.product.currency
                    )}
                  </span>
                </div>
              ))}
              <div style={styles.summaryTotal}>
                <span style={styles.summaryTotalLabel}>Total</span>
                <span style={styles.summaryTotalValue}>
                  {formatPrice(totalAmount, cartCurrency)}
                </span>
              </div>
            </div>
          )}

          {/* Idle: Pay button */}
          {step === "idle" && (
            <button style={styles.payButton} onClick={handlePay}>
              Pay {formatPrice(totalAmount, cartCurrency)}
            </button>
          )}

          {/* Creating: loading */}
          {step === "creating" && (
            <div style={styles.spinnerContainer}>
              <div style={styles.spinner} />
              <p style={styles.spinnerText}>Creating checkout...</p>
            </div>
          )}

          {/* Payment: embedded checkout form */}
          {step === "payment" && (
            <div id="embedded-checkout-container" style={styles.checkoutContainer} />
          )}

          {/* Confirming: loading */}
          {step === "confirming" && (
            <div style={styles.spinnerContainer}>
              <div style={styles.spinner} />
              <p style={styles.spinnerText}>Confirming payment...</p>
            </div>
          )}

          {/* Success */}
          {step === "success" && (
            <div style={styles.resultContainer}>
              <div style={styles.successIcon}>&#10003;</div>
              <p style={styles.resultTitle}>Payment successful!</p>
              {confirmationId && (
                <p style={styles.confirmationId}>
                  Confirmation: {confirmationId}
                </p>
              )}
              <button style={styles.payButton} onClick={handleDone}>
                Done
              </button>
            </div>
          )}

          {/* Error */}
          {step === "error" && (
            <div style={styles.resultContainer}>
              <div style={styles.errorIcon}>!</div>
              <p style={styles.resultTitle}>Payment failed</p>
              <p style={styles.errorMessage}>{errorMessage}</p>
              <button style={styles.payButton} onClick={handleRetry}>
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 200,
  },
  modal: {
    backgroundColor: "#fff",
    borderRadius: "16px",
    width: "90%",
    maxWidth: "480px",
    maxHeight: "85vh",
    display: "flex",
    flexDirection: "column" as const,
    boxShadow: "0 16px 48px rgba(0,0,0,0.15)",
    fontFamily: "system-ui, -apple-system, sans-serif",
    overflow: "hidden",
  },
  modalHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "20px 24px",
    borderBottom: "1px solid #eee",
  },
  modalTitle: {
    fontSize: "18px",
    fontWeight: 600,
    color: "#111",
  },
  closeButton: {
    background: "none",
    border: "none",
    fontSize: "24px",
    cursor: "pointer",
    color: "#666",
    lineHeight: 1,
    padding: "0 4px",
  },
  modalBody: {
    padding: "24px",
    overflowY: "auto" as const,
    display: "flex",
    flexDirection: "column" as const,
    gap: "20px",
  },
  summary: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "8px",
  },
  summaryRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
  },
  summaryName: {
    fontSize: "14px",
    color: "#444",
    flex: 1,
  },
  summaryPrice: {
    fontSize: "14px",
    fontWeight: 500,
    color: "#111",
    whiteSpace: "nowrap" as const,
  },
  summaryTotal: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderTop: "1px solid #eee",
    paddingTop: "12px",
    marginTop: "4px",
  },
  summaryTotalLabel: {
    fontSize: "15px",
    fontWeight: 600,
    color: "#111",
  },
  summaryTotalValue: {
    fontSize: "17px",
    fontWeight: 700,
    color: "#111",
  },
  payButton: {
    padding: "14px",
    fontSize: "15px",
    fontWeight: 600,
    fontFamily: "system-ui, -apple-system, sans-serif",
    color: "#fff",
    backgroundColor: "#111",
    border: "none",
    borderRadius: "12px",
    cursor: "pointer",
    width: "100%",
  },
  spinnerContainer: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: "12px",
    padding: "24px 0",
  },
  spinner: {
    width: "32px",
    height: "32px",
    border: "3px solid #eee",
    borderTopColor: "#111",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  spinnerText: {
    fontSize: "14px",
    color: "#666",
    margin: 0,
  },
  checkoutContainer: {
    minHeight: "200px",
  },
  resultContainer: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: "12px",
    padding: "16px 0",
  },
  successIcon: {
    width: "48px",
    height: "48px",
    borderRadius: "50%",
    backgroundColor: "#e8f5e9",
    color: "#2e7d32",
    fontSize: "24px",
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  errorIcon: {
    width: "48px",
    height: "48px",
    borderRadius: "50%",
    backgroundColor: "#ffebee",
    color: "#c62828",
    fontSize: "24px",
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  resultTitle: {
    fontSize: "16px",
    fontWeight: 600,
    color: "#111",
    margin: 0,
  },
  confirmationId: {
    fontSize: "13px",
    color: "#666",
    margin: 0,
    fontFamily: "monospace",
  },
  errorMessage: {
    fontSize: "14px",
    color: "#666",
    margin: 0,
    textAlign: "center" as const,
  },
};
