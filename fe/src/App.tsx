import { useEffect, useRef, useState } from "react";
import ProductModal from "./ProductModal";
import CheckoutModal from "./CheckoutModal";

export interface Product {
  id: number;
  name: string;
  description: string;
  keywords: string[];
  imgUrl: string;
  amount: number;
  currency: "USD" | "EUR" | "JPY";
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export type DisplayCurrency = "default" | "USD" | "EUR" | "JPY";

const currencyFormat: Record<string, Intl.NumberFormatOptions> = {
  USD: { style: "currency", currency: "USD" },
  EUR: { style: "currency", currency: "EUR" },
  JPY: { style: "currency", currency: "JPY", maximumFractionDigits: 0 },
};

// Same rates as server — converts to USD baseline
const USD_RATES: Record<string, number> = {
  USD: 1,
  EUR: 1.08,
  JPY: 0.0067,
};

export function convertPrice(amount: number, from: string, to: string): number {
  if (from === to) return amount;
  const inUSD = amount * (USD_RATES[from] ?? 1);
  return inUSD / (USD_RATES[to] ?? 1);
}

export function formatPrice(amount: number, currency: string) {
  const opts = currencyFormat[currency] ?? { style: "currency", currency };
  return new Intl.NumberFormat("en-US", opts).format(amount);
}

export function displayPrice(amount: number, originalCurrency: string, displayCurrency: DisplayCurrency) {
  if (displayCurrency === "default") return formatPrice(amount, originalCurrency);
  const converted = convertPrice(amount, originalCurrency, displayCurrency);
  return formatPrice(converted, displayCurrency);
}

function CartIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  );
}

function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [displayCurrency, setDisplayCurrency] = useState<DisplayCurrency>("default");
  const cartCurrency = displayCurrency === "default" ? "USD" : displayCurrency;
  const [showCheckout, setShowCheckout] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(null);

  function showToast(message: string, type: "success" | "error" = "success") {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }

  const filteredProducts = search
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.keywords.some((kw) =>
            kw.toLowerCase().includes(search.toLowerCase())
          )
      )
    : products;

  useEffect(() => {
    fetch("http://localhost:3000/products")
      .then((res) => res.json())
      .then((data) => setProducts(data))
      .catch(() => showToast("Failed to load products", "error"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={styles.loading}>
        <p>Loading products...</p>
      </div>
    );
  }

  const sidebarTotal = cart.reduce(
    (sum, item) =>
      sum + convertPrice(item.product.amount, item.product.currency, cartCurrency) * item.quantity,
    0
  );

  function updateQuantity(productId: number, delta: number) {
    const item = cart.find((i) => i.product.id === productId);
    if (!item) return;
    const newQty = item.quantity + delta;
    if (newQty <= 0) {
      setCart((prev) => prev.filter((i) => i.product.id !== productId));
      showToast(`Removed ${item.product.name} from cart`);
    } else {
      setCart((prev) =>
        prev.map((i) =>
          i.product.id === productId ? { ...i, quantity: newQty } : i
        )
      );
    }
  }

  function removeFromCart(productId: number) {
    const item = cart.find((i) => i.product.id === productId);
    setCart((prev) => prev.filter((i) => i.product.id !== productId));
    if (item) showToast(`Removed ${item.product.name} from cart`);
  }

  return (
    <div style={styles.page}>

      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          displayCurrency={displayCurrency}
          onAddToCart={(product, quantity) => {
            setCart((prev) => {
              const existing = prev.find((item) => item.product.id === product.id);
              if (existing) {
                return prev.map((item) =>
                  item.product.id === product.id
                    ? { ...item, quantity: item.quantity + quantity }
                    : item
                );
              }
              return [...prev, { product, quantity }];
            });
            showToast(`Added ${quantity} ${product.name} to cart`);
          }}
          onClose={() => setSelectedProduct(null)}
        />
      )}

      {showCheckout && (
        <CheckoutModal
          cart={cart}
          cartCurrency={cartCurrency}
          totalAmount={sidebarTotal}
          onClose={() => setShowCheckout(false)}
          onSuccess={() => setCart([])}
          showToast={showToast}
        />
      )}

      <div style={styles.content}>
        <div style={styles.toolbar}>
          <input
            style={styles.searchInput}
            type="text"
            placeholder="Search by name or keyword..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            style={styles.currencySelect}
            value={displayCurrency}
            onChange={(e) => setDisplayCurrency(e.target.value as DisplayCurrency)}
          >
            <option value="default">Default</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="JPY">JPY</option>
          </select>
        </div>
        {filteredProducts.length === 0 ? (
          <p style={styles.noResults}>
            No products found for "{search}"
          </p>
        ) : (
          <div style={styles.grid}>
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                style={styles.card}
                onClick={() => setSelectedProduct(product)}
              >
                <div style={styles.imageWrapper}>
                  <img
                    src={product.imgUrl}
                    alt={product.name}
                    style={styles.image}
                  />
                </div>
                <div style={styles.info}>
                  <span style={styles.name}>{product.name}</span>
                  <span style={styles.price}>
                    {displayPrice(product.amount, product.currency, displayCurrency)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={styles.sidebar}>
        <div style={styles.sidebarTitleRow}>
          <CartIcon />
          <span style={styles.sidebarTitle}>
            Cart{cart.length > 0 ? ` (${cart.reduce((n, i) => n + i.quantity, 0)})` : ""}
          </span>
        </div>
        {cart.length === 0 ? (
          <p style={styles.sidebarEmpty}>Your cart is empty.</p>
        ) : (
          <>
            <div style={styles.sidebarItems}>
              {cart.map((item) => (
                <div key={item.product.id} style={styles.sidebarItem}>
                  <div style={styles.sidebarItemInfo}>
                    <span style={styles.sidebarItemName}>{item.product.name}</span>
                    <span style={styles.sidebarItemPrice}>
                      {formatPrice(
                        convertPrice(item.product.amount, item.product.currency, cartCurrency) * item.quantity,
                        cartCurrency
                      )}
                    </span>
                  </div>
                  <div style={styles.sidebarItemControls}>
                    <button
                      style={styles.sidebarQtyButton}
                      onClick={() => updateQuantity(item.product.id, -1)}
                      aria-label="Decrease quantity"
                    >
                      &minus;
                    </button>
                    <span style={styles.sidebarQtyValue}>{item.quantity}</span>
                    <button
                      style={styles.sidebarQtyButton}
                      onClick={() => updateQuantity(item.product.id, 1)}
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                    <button
                      style={styles.sidebarRemoveButton}
                      onClick={() => removeFromCart(item.product.id)}
                      aria-label={`Remove ${item.product.name}`}
                    >
                      &times;
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div style={styles.sidebarTotal}>
              <span style={styles.sidebarTotalLabel}>Total</span>
              <span style={styles.sidebarTotalValue}>{formatPrice(sidebarTotal, cartCurrency)}</span>
            </div>
            <button
              style={styles.checkoutButton}
              onClick={() => setShowCheckout(true)}
            >
              Checkout
            </button>
          </>
        )}
      </div>

      {toast && (
        <div
          style={{
            ...styles.toast,
            backgroundColor: toast.type === "error" ? "#d32f2f" : "#333",
          }}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#f8f8f8",
    padding: "48px 24px",
    display: "flex",
    justifyContent: "center",
    gap: "32px",
  },
  content: {
    maxWidth: "960px",
    width: "100%",
    display: "flex",
    flexDirection: "column" as const,
    gap: "24px",
  },
  toolbar: {
    display: "flex",
    gap: "12px",
    alignItems: "center",
  },
  searchInput: {
    flex: 1,
    padding: "12px 16px",
    fontSize: "15px",
    fontFamily: "system-ui, -apple-system, sans-serif",
    border: "1px solid #e5e5e5",
    borderRadius: "12px",
    outline: "none",
    backgroundColor: "#fff",
    boxSizing: "border-box" as const,
  },
  currencySelect: {
    padding: "12px 16px",
    fontSize: "15px",
    fontFamily: "system-ui, -apple-system, sans-serif",
    border: "1px solid #e5e5e5",
    borderRadius: "12px",
    backgroundColor: "#fff",
    color: "#111",
    cursor: "pointer",
    outline: "none",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "32px",
  },
  card: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    cursor: "pointer",
  },
  imageWrapper: {
    aspectRatio: "1",
    borderRadius: "16px",
    overflow: "hidden",
    backgroundColor: "#ffffff",
    border: "1px solid #e5e5e5",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  info: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    padding: "0 4px",
  },
  name: {
    fontSize: "15px",
    fontWeight: 600,
    color: "#111",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  price: {
    fontSize: "14px",
    fontWeight: 400,
    color: "#555",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  sidebar: {
    width: "280px",
    flexShrink: 0,
    position: "sticky" as const,
    top: "48px",
    alignSelf: "flex-start",
    backgroundColor: "#fff",
    border: "1px solid #e5e5e5",
    borderRadius: "16px",
    padding: "20px",
    display: "flex",
    flexDirection: "column" as const,
    gap: "16px",
    fontFamily: "system-ui, -apple-system, sans-serif",
    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
  },
  sidebarTitleRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    color: "#111",
  },
  sidebarTitle: {
    fontSize: "15px",
    fontWeight: 700,
    color: "#111",
  },
  sidebarEmpty: {
    color: "#999",
    fontSize: "13px",
    textAlign: "center" as const,
    margin: "8px 0",
  },
  sidebarItems: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "12px",
  },
  sidebarItem: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "6px",
  },
  sidebarItemInfo: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "8px",
  },
  sidebarItemName: {
    fontSize: "13px",
    color: "#444",
    flex: 1,
  },
  sidebarItemPrice: {
    fontSize: "13px",
    fontWeight: 600,
    color: "#111",
    whiteSpace: "nowrap" as const,
  },
  sidebarItemControls: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  sidebarQtyButton: {
    width: "24px",
    height: "24px",
    borderRadius: "6px",
    border: "1px solid #ddd",
    backgroundColor: "#fff",
    fontSize: "12px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#333",
  },
  sidebarQtyValue: {
    fontSize: "13px",
    fontWeight: 600,
    minWidth: "16px",
    textAlign: "center" as const,
    color: "#111",
  },
  sidebarRemoveButton: {
    background: "none",
    border: "none",
    fontSize: "16px",
    cursor: "pointer",
    color: "#999",
    padding: "0 4px",
    lineHeight: 1,
    marginLeft: "auto",
  },
  sidebarTotal: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderTop: "1px solid #eee",
    paddingTop: "12px",
  },
  sidebarTotalLabel: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#111",
  },
  sidebarTotalValue: {
    fontSize: "16px",
    fontWeight: 700,
    color: "#111",
  },
  checkoutButton: {
    padding: "12px",
    fontSize: "14px",
    fontWeight: 600,
    fontFamily: "system-ui, -apple-system, sans-serif",
    color: "#fff",
    backgroundColor: "#111",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
    width: "100%",
  },
  noResults: {
    textAlign: "center" as const,
    color: "#999",
    fontSize: "15px",
    fontFamily: "system-ui, -apple-system, sans-serif",
    padding: "48px 0",
    margin: 0,
  },
  toast: {
    position: "fixed" as const,
    bottom: "32px",
    left: "50%",
    transform: "translateX(-50%)",
    color: "#fff",
    padding: "12px 24px",
    borderRadius: "10px",
    fontSize: "14px",
    fontFamily: "system-ui, -apple-system, sans-serif",
    fontWeight: 500,
    boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
    zIndex: 300,
    whiteSpace: "nowrap" as const,
  },
  loading: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "system-ui, -apple-system, sans-serif",
    color: "#555",
  },
};

export default App;
