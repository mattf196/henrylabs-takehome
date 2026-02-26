import { useState } from "react";
import type { Product, DisplayCurrency } from "./App";
import { displayPrice } from "./App";

interface ProductModalProps {
  product: Product;
  displayCurrency: DisplayCurrency;
  onAddToCart: (product: Product, quantity: number) => void;
  onClose: () => void;
}

export default function ProductModal({ product, displayCurrency, onAddToCart, onClose }: ProductModalProps) {
  const [quantity, setQuantity] = useState(1);

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <span style={styles.modalTitle}>{product.name}</span>
          <button
            style={styles.closeButton}
            onClick={onClose}
            aria-label="Close product details"
          >
            &times;
          </button>
        </div>
        <div style={styles.modalBody}>
          <div style={styles.imageWrapper}>
            <img
              src={product.imgUrl}
              alt={product.name}
              style={styles.image}
            />
          </div>
          <div style={styles.details}>
            <span style={styles.price}>
              {displayPrice(product.amount, product.currency, displayCurrency)}
            </span>
            <p style={styles.description}>{product.description}</p>
            <div style={styles.keywords}>
              {product.keywords.map((kw) => (
                <span key={kw} style={styles.keyword}>
                  {kw}
                </span>
              ))}
            </div>
            <div style={styles.quantityRow}>
              <span style={styles.quantityLabel}>Quantity</span>
              <div style={styles.quantityControls}>
                <button
                  style={styles.quantityButton}
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  aria-label="Decrease quantity"
                >
                  &minus;
                </button>
                <span style={styles.quantityValue}>{quantity}</span>
                <button
                  style={styles.quantityButton}
                  onClick={() => setQuantity((q) => q + 1)}
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>
            </div>
            <button
              style={styles.addToCartButton}
              onClick={() => onAddToCart(product, quantity)}
            >
              Add to Cart
            </button>
          </div>
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
    maxWidth: "680px",
    maxHeight: "80vh",
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
    overflowY: "auto" as const,
  },
  imageWrapper: {
    padding: "24px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8f8f8",
  },
  image: {
    width: "60%",
    aspectRatio: "1",
    objectFit: "cover",
    borderRadius: "12px",
  },
  details: {
    padding: "20px 24px 24px",
    display: "flex",
    flexDirection: "column" as const,
    gap: "12px",
  },
  price: {
    fontSize: "20px",
    fontWeight: 600,
    color: "#111",
  },
  description: {
    fontSize: "14px",
    lineHeight: "1.5",
    color: "#444",
    margin: 0,
  },
  keywords: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "6px",
  },
  keyword: {
    fontSize: "12px",
    color: "#666",
    backgroundColor: "#f0f0f0",
    borderRadius: "12px",
    padding: "4px 10px",
  },
  quantityRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: "4px",
  },
  quantityLabel: {
    fontSize: "14px",
    fontWeight: 500,
    color: "#333",
  },
  quantityControls: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  quantityButton: {
    width: "32px",
    height: "32px",
    borderRadius: "8px",
    border: "1px solid #ddd",
    backgroundColor: "#fff",
    fontSize: "16px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#333",
  },
  quantityValue: {
    fontSize: "15px",
    fontWeight: 600,
    minWidth: "20px",
    textAlign: "center" as const,
    color: "#111",
  },
  addToCartButton: {
    marginTop: "4px",
    padding: "14px",
    fontSize: "15px",
    fontWeight: 600,
    fontFamily: "system-ui, -apple-system, sans-serif",
    color: "#fff",
    backgroundColor: "#111",
    border: "none",
    borderRadius: "12px",
    cursor: "pointer",
  },
};
