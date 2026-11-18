import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

// HU20: la app sigue funcionando en modo de memoria si AsyncStorage falla o no está disponible.
let storage = null;
try {
  storage = require('@react-native-async-storage/async-storage').default;
} catch (_error) {
  storage = null;
}

const STORAGE_KEY = 'kipus-market-state-v1';
const BLUE = '#1E3A8A';
const ORANGE = '#F97316';
const CATEGORIES = ['Tecnología', 'Papelería', 'Ropa', 'Calzado'];
const CATEGORY_FILTERS = ['Todas', ...CATEGORIES];

// HU03: catálogo inicial solicitado, con precios COP enteros y sin inventario descontado por agregar al carrito.
const INITIAL_PRODUCTS = [
  { id: 'PROD-001', nombre: 'Audífonos Bluetooth StudyBeat', categoria: 'Tecnología', precio: 45000, stock: 10, descripcion: 'Audífonos inalámbricos ligeros con 18 horas de batería y micrófono integrado para clases virtuales.' },
  { id: 'PROD-002', nombre: 'Mouse Inalámbrico ErgoClick', categoria: 'Tecnología', precio: 28000, stock: 15, descripcion: 'Mouse silencioso con receptor USB de bajo consumo, ideal para trabajar en la biblioteca o en clase.' },
  { id: 'PROD-003', nombre: 'Memoria USB 64GB Metal', categoria: 'Tecnología', precio: 32000, stock: 0, descripcion: 'Unidad flash resistente de alta velocidad para guardar proyectos, planos y presentaciones.' },
  { id: 'PROD-004', nombre: 'Kit 5 Cuadernos Argollados', categoria: 'Papelería', precio: 24000, stock: 20, descripcion: 'Paquete de cinco cuadernos cuadriculados de 100 hojas con pasta dura resistente al uso diario.' },
  { id: 'PROD-005', nombre: 'Set Resaltadores Pastel x6', categoria: 'Papelería', precio: 14000, stock: 18, descripcion: 'Marcadores de punta biselada en tonos suaves que no traspasan la hoja del cuaderno.' },
  { id: 'PROD-006', nombre: 'Calculadora Científica FX-Plus', categoria: 'Papelería', precio: 42000, stock: 7, descripcion: 'Calculadora con 240 funciones matemáticas y estadísticas para ingeniería y bachillerato.' },
  { id: 'PROD-007', nombre: 'Buso Hoodie Básico Campus', categoria: 'Ropa', precio: 65000, stock: 9, descripcion: 'Saco con capota en algodón perchado térmico, ideal para las mañanas frías de la Sabana.' },
  { id: 'PROD-008', nombre: 'Camiseta Algodón Oversize', categoria: 'Ropa', precio: 35000, stock: 14, descripcion: 'Camiseta fresca 100 % algodón de corte cómodo en colores neutros fáciles de combinar.' },
  { id: 'PROD-009', nombre: 'Jean Clásico Stretch Azul', categoria: 'Ropa', precio: 78000, stock: 6, descripcion: 'Pantalón resistente con tejido flexible diseñado para soportar el ritmo diario universitario.' },
  { id: 'PROD-010', nombre: 'Tenis Urbanos Blancos Daily', categoria: 'Calzado', precio: 89000, stock: 8, descripcion: 'Calzado casual liviano con suela antideslizante y plantilla acolchada para largas jornadas.' },
  { id: 'PROD-011', nombre: 'Tenis Deportivos Runner Lite', categoria: 'Calzado', precio: 95000, stock: 5, descripcion: 'Zapatillas transpirables de alto agarre aptas para entrenamiento físico y uso diario.' },
  { id: 'PROD-012', nombre: 'Botines Lona Resistente', categoria: 'Calzado', precio: 82000, stock: 4, descripcion: 'Calzado tipo bota en lona gruesa impermeable con puntera reforzada para días de lluvia.' },
];

const formatCOP = (amount) => `$${Math.round(amount || 0).toLocaleString('es-CO')} COP`;

const isValidSavedOrder = (order) => {
  if (!order || typeof order.code !== 'string' || !order.code.trim()
    || typeof order.createdAt !== 'string' || Number.isNaN(Date.parse(order.createdAt))
    || !order.buyer || !['nombre', 'telefono', 'municipio', 'direccion']
      .every((key) => typeof order.buyer[key] === 'string')
    || !Array.isArray(order.items)
    || !Number.isSafeInteger(order.subtotal) || order.subtotal < 0
    || !Number.isSafeInteger(order.discount) || order.discount < 0
    || !Number.isSafeInteger(order.shipping) || ![0, 8000].includes(order.shipping)
    || !Number.isSafeInteger(order.total) || order.total < 0) return false;
  const validItems = order.items.every((item) => item
    && typeof item.productId === 'string'
    && typeof item.nombre === 'string'
    && Number.isSafeInteger(item.cantidad) && item.cantidad > 0
    && Number.isSafeInteger(item.precioUnitario) && item.precioUnitario > 0
    && Number.isSafeInteger(item.totalLinea)
    && item.totalLinea === item.cantidad * item.precioUnitario);
  if (!validItems) return false;
  const computedSubtotal = order.items.reduce((sum, item) => sum + item.totalLinea, 0);
  return Number.isSafeInteger(computedSubtotal)
    && computedSubtotal === order.subtotal
    && order.discount <= order.subtotal
    && order.total === order.subtotal - order.discount + order.shipping;
};

function ActionButton({ label, onPress, variant = 'primary', disabled = false, compact = false }) {
  return (
    <Text
      accessibilityRole="button"
      onPress={disabled ? undefined : onPress}
      style={[
        styles.button,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'outline' && styles.buttonOutline,
        variant === 'danger' && styles.buttonDanger,
        disabled && styles.buttonDisabled,
        compact && styles.buttonCompact,
      ]}
    >
      {label}
    </Text>
  );
}

function Field({ label, value, onChangeText, placeholder, keyboardType, multiline = false }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder || label}
        placeholderTextColor="#94A3B8"
        keyboardType={keyboardType || 'default'}
        multiline={multiline}
        style={[styles.input, multiline && styles.multilineInput]}
      />
    </View>
  );
}

export default function App() {
  // HU01: marca y eslogan se muestran permanentemente en el encabezado común de todas las vistas.
  const [products, setProducts] = useState(INITIAL_PRODUCTS);
  const [favorites, setFavorites] = useState([]);
  const [cart, setCart] = useState([]);
  const [orders, setOrders] = useState([]);
  const [screen, setScreen] = useState('catalog');
  const [activeTab, setActiveTab] = useState('catalog');
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Todas');
  const [sortOrder, setSortOrder] = useState('');
  const [banner, setBanner] = useState('');
  const [couponInput, setCouponInput] = useState('');
  const [couponApplied, setCouponApplied] = useState(false);
  const [buyer, setBuyer] = useState({ nombre: '', telefono: '', municipio: '', direccion: '' });
  const [ratingInput, setRatingInput] = useState('');
  const [sellerForm, setSellerForm] = useState({
    nombre: '', categoria: CATEGORIES[0], precio: '', stock: '', descripcion: '',
  });
  const [editingProductId, setEditingProductId] = useState(null);
  const [hydrated, setHydrated] = useState(false);

  // HU20: recuperación defensiva y limpieza de datos persistidos antes de mostrarlos.
  useEffect(() => {
    let active = true;
    const restore = async () => {
      try {
        if (storage) {
          const raw = await storage.getItem(STORAGE_KEY);
          if (raw) {
            const saved = JSON.parse(raw);
            if (saved && typeof saved === 'object' && active) {
              const savedProducts = Array.isArray(saved.products)
                ? saved.products.filter((item) => item
                  && typeof item.id === 'string'
                  && typeof item.nombre === 'string'
                  && CATEGORIES.includes(item.categoria)
                  && Number.isSafeInteger(item.precio) && item.precio > 0
                  && Number.isSafeInteger(item.stock) && item.stock >= 0
                  && typeof item.descripcion === 'string')
                  .reduce((valid, item) => {
                    if (valid.some((existing) => existing.id === item.id)) return valid;
                    return [...valid, {
                      ...item,
                      reviews: Array.isArray(item.reviews)
                        ? item.reviews.filter((vote) => Number.isInteger(vote) && vote >= 1 && vote <= 5)
                        : [],
                    }];
                  }, [])
                : INITIAL_PRODUCTS;
              const ids = savedProducts.map((item) => item.id);
              const savedFavorites = Array.isArray(saved.favorites)
                ? saved.favorites.filter((id, index, list) => ids.includes(id) && list.indexOf(id) === index)
                : [];
              const savedCart = Array.isArray(saved.cart)
                ? saved.cart.reduce((valid, line) => {
                  const product = savedProducts.find((item) => item.id === line.productId);
                  if (!product || !Number.isInteger(line.quantity) || line.quantity <= 0) return valid;
                  const existing = valid.find((item) => item.productId === line.productId);
                  const totalQuantity = (existing ? existing.quantity : 0) + line.quantity;
                  if (totalQuantity > product.stock) return valid;
                  return existing
                    ? valid.map((item) => item.productId === line.productId
                      ? { ...item, quantity: totalQuantity }
                      : item)
                    : [...valid, { productId: line.productId, quantity: line.quantity }];
                }, [])
                : [];
              const savedOrders = Array.isArray(saved.orders)
                ? saved.orders.filter(isValidSavedOrder)
                : [];
              setProducts(savedProducts);
              setFavorites(savedFavorites);
              setCart(savedCart);
              setOrders(savedOrders);
            }
          }
        }
      } catch (_error) {
        if (active) setBanner('No fue posible restaurar los datos guardados. La app seguirá disponible.');
      } finally {
        if (active) setHydrated(true);
      }
    };
    restore();
    return () => { active = false; };
  }, []);

  // HU20: guardado automático del inventario, favoritos, carrito e historial una vez finalizada la restauración.
  useEffect(() => {
    if (!hydrated || !storage) return;
    storage.setItem(STORAGE_KEY, JSON.stringify({ products, favorites, cart, orders }))
      .catch(() => setBanner('No se pudieron guardar los cambios localmente.'));
  }, [products, favorites, cart, orders, hydrated]);

  const selectedProduct = products.find((item) => item.id === selectedProductId);
  const selectedOrder = orders.find((order) => order.code === selectedOrderId);
  const cartCount = cart.reduce((total, line) => total + line.quantity, 0);

  // HU11 y HU17: resumen derivado de cantidades actuales; el cupón nunca genera descuento negativo.
  const summary = useMemo(() => {
    const subtotal = cart.reduce((total, line) => {
      const product = products.find((item) => item.id === line.productId);
      return total + (product ? product.precio * line.quantity : 0);
    }, 0);
    const discount = couponApplied && cart.length ? Math.min(subtotal, Math.round(subtotal * 0.1)) : 0;
    const shipping = !cart.length ? 0 : (subtotal < 150000 ? 8000 : 0);
    return { subtotal, discount, shipping, total: Math.max(0, subtotal - discount + shipping) };
  }, [cart, products, couponApplied]);

  // HU16: retroalimentación visible en la interfaz para acciones y validaciones.
  const showMessage = (message) => setBanner(message);
  const goToTab = (tab) => {
    setActiveTab(tab);
    setScreen(tab);
  };

  // HU08: mismo control inmutable de favoritos en tarjetas y detalle.
  const toggleFavorite = (productId) => {
    const isFavorite = favorites.includes(productId);
    setFavorites((current) => isFavorite
      ? current.filter((id) => id !== productId)
      : [...current, productId]);
    showMessage(isFavorite ? 'Producto retirado de favoritos.' : 'Producto agregado a favoritos.');
  };

  // HU09: agregar no modifica inventario; limita la cantidad a las existencias actuales.
  const addToCart = (product) => {
    if (!product || product.stock <= 0) {
      showMessage('Este producto está agotado y no se puede agregar.');
      return;
    }
    const currentLine = cart.find((line) => line.productId === product.id);
    if (currentLine && currentLine.quantity >= product.stock) {
      showMessage('No puedes superar el stock disponible de este producto.');
      return;
    }
    setCart((current) => currentLine
      ? current.map((line) => line.productId === product.id
        ? { ...line, quantity: line.quantity + 1 }
        : line)
      : [...current, { productId: product.id, quantity: 1 }]);
    showMessage(`${product.nombre} agregado al carrito.`);
  };

  // HU10: ajustes de cantidad inmutables, con validación de stock y eliminación explícita.
  const changeQuantity = (product, delta) => {
    const line = cart.find((item) => item.productId === product.id);
    if (!line) return;
    if (delta > 0 && line.quantity >= product.stock) {
      showMessage('No puedes superar el stock disponible.');
      return;
    }
    if (line.quantity + delta < 1) {
      showMessage('La cantidad mínima es 1. Usa Eliminar para quitar el producto.');
      return;
    }
    setCart((current) => current.map((item) => item.productId === product.id
      ? { ...item, quantity: item.quantity + delta }
      : item));
    showMessage('Cantidad del carrito actualizada.');
  };

  const removeFromCart = (productId) => {
    setCart((current) => current.filter((line) => line.productId !== productId));
    showMessage('Producto eliminado del carrito.');
  };

  const applyCoupon = () => {
    if (!cart.length) {
      showMessage('Agrega productos antes de aplicar un cupón.');
      return;
    }
    if (couponInput.trim().toUpperCase() === 'BIENVENIDO10') {
      setCouponApplied(true);
      showMessage('Cupón aplicado: tienes 10% de descuento.');
    } else {
      showMessage('Cupón no válido. Verifica el código e inténtalo de nuevo.');
    }
  };

  // HU12: el formulario solicita únicamente nombre, teléfono, municipio y dirección.
  const validateBuyer = () => {
    const labels = { nombre: 'Nombre', telefono: 'Teléfono', municipio: 'Municipio', direccion: 'Dirección' };
    const missing = Object.keys(labels).filter((key) => !buyer[key].trim());
    if (missing.length) {
      showMessage(`Completa los siguientes campos: ${missing.map((key) => labels[key]).join(', ')}.`);
      return false;
    }
    return true;
  };

  // HU13-HU15: valida toda la compra antes de mutar stock y guarda una copia inmutable del pedido.
  const confirmPurchase = () => {
    if (!validateBuyer()) return;
    if (!cart.length) {
      showMessage('Tu carrito está vacío.');
      return;
    }
    const invalidLine = cart.find((line) => {
      const product = products.find((item) => item.id === line.productId);
      return !product || line.quantity > product.stock;
    });
    if (invalidLine) {
      showMessage('La compra fue cancelada: un producto ya no tiene stock suficiente. No se descontó inventario.');
      return;
    }
    const baseCode = `PED-${Date.now()}`;
    let suffix = orders.length + 1;
    while (orders.some((order) => order.code === `${baseCode}-${suffix}`)) suffix += 1;
    const code = `${baseCode}-${suffix}`;
    const items = cart.map((line) => {
      const product = products.find((item) => item.id === line.productId);
      return {
        productId: product.id,
        nombre: product.nombre,
        cantidad: line.quantity,
        precioUnitario: product.precio,
        totalLinea: product.precio * line.quantity,
      };
    });
    // HU15: se conserva una instantánea con precios y cantidades para el detalle histórico.
    const order = {
      code,
      createdAt: new Date().toISOString(),
      buyer: { ...buyer },
      items,
      subtotal: summary.subtotal,
      discount: summary.discount,
      shipping: summary.shipping,
      total: summary.total,
    };
    // HU14: el inventario se descuenta solo después de validar todas las líneas de la compra.
    setProducts((current) => current.map((product) => {
      const purchased = cart.find((line) => line.productId === product.id);
      return purchased ? { ...product, stock: product.stock - purchased.quantity } : product;
    }));
    setOrders((current) => [order, ...current]);
    setCart([]);
    setCouponApplied(false);
    setCouponInput('');
    setScreen('history');
    setActiveTab('history');
    showMessage(`Pedido ${code} confirmado. Simulación académica: no se realizó ningún cobro real.`);
  };

  // HU18: el formulario único permite crear un producto o editarlo sin duplicar registros.
  const saveSellerProduct = () => {
    const price = Number(sellerForm.precio);
    const stock = Number(sellerForm.stock);
    if (!sellerForm.nombre.trim()) {
      showMessage('Escribe el nombre del producto.');
      return;
    }
    if (!CATEGORIES.includes(sellerForm.categoria)) {
      showMessage('Selecciona una categoría válida.');
      return;
    }
    if (!sellerForm.precio.trim() || !Number.isSafeInteger(price) || price <= 0) {
      showMessage('El precio debe ser un entero mayor que 0.');
      return;
    }
    if (!sellerForm.stock.trim() || !Number.isSafeInteger(stock) || stock < 0) {
      showMessage('El stock debe ser un entero igual o mayor que 0.');
      return;
    }
    if (sellerForm.descripcion.trim().length < 15) {
      showMessage('La descripción debe tener al menos 15 caracteres.');
      return;
    }
    if (editingProductId) {
      setProducts((current) => current.map((product) => product.id === editingProductId
        ? {
          ...product,
          nombre: sellerForm.nombre.trim(),
          categoria: sellerForm.categoria,
          precio: price,
          stock,
          descripcion: sellerForm.descripcion.trim(),
        }
        : product));
      showMessage('Producto actualizado correctamente.');
    } else {
      const maxId = products.reduce((max, product) => {
        const number = Number(product.id.replace('PROD-', ''));
        return Number.isInteger(number) ? Math.max(max, number) : max;
      }, 0);
      const newProduct = {
        id: `PROD-${String(maxId + 1).padStart(3, '0')}`,
        nombre: sellerForm.nombre.trim(),
        categoria: sellerForm.categoria,
        precio: price,
        stock,
        descripcion: sellerForm.descripcion.trim(),
        reviews: [],
      };
      setProducts((current) => [...current, newProduct]);
      showMessage('Producto creado correctamente.');
    }
    setEditingProductId(null);
    setSellerForm({ nombre: '', categoria: CATEGORIES[0], precio: '', stock: '', descripcion: '' });
  };

  const startEditingProduct = (product) => {
    setEditingProductId(product.id);
    setSellerForm({
      nombre: product.nombre,
      categoria: product.categoria,
      precio: String(product.precio),
      stock: String(product.stock),
      descripcion: product.descripcion,
    });
    showMessage(`Editando ${product.nombre}.`);
  };

  // HU19: calificaciones enteras de 1 a 5 y promedio calculado a partir de votos guardados.
  const submitReview = () => {
    const normalized = ratingInput.trim();
    if (!/^[1-5]$/.test(normalized)) {
      showMessage('La calificación debe ser un número entero entre 1 y 5.');
      return;
    }
    setProducts((current) => current.map((product) => product.id === selectedProductId
      ? { ...product, reviews: [...(product.reviews || []), Number(normalized)] }
      : product));
    setRatingInput('');
    showMessage('¡Gracias! Tu reseña ficticia fue registrada.');
  };

  const openDetail = (product) => {
    setSelectedProductId(product.id);
    setScreen('detail');
  };

  const filteredProducts = useMemo(() => {
    // HU04: la búsqueda no distingue mayúsculas y al limpiarla conserva filtros y orden actuales.
    let result = products.filter((product) => {
      // HU05: categoría y búsqueda se aplican conjuntamente sobre el catálogo.
      const matchesCategory = category === 'Todas' || product.categoria === category;
      const term = query.trim().toLocaleLowerCase();
      const matchesQuery = !term || `${product.nombre} ${product.categoria} ${product.descripcion}`
        .toLocaleLowerCase().includes(term);
      return matchesCategory && matchesQuery;
    });
    if (screen === 'favorites') result = result.filter((product) => favorites.includes(product.id));
    // HU06: ordenar crea una copia, conserva filtros y no muta el catálogo original.
    if (sortOrder === 'asc') result = [...result].sort((a, b) => a.precio - b.precio);
    if (sortOrder === 'desc') result = [...result].sort((a, b) => b.precio - a.precio);
    return result;
  }, [products, category, query, sortOrder, screen, favorites]);

  const renderProductCard = (product) => (
    <View key={product.id} style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.categoryLabel}>{product.categoria}</Text>
        <Text
          accessibilityRole="button"
          onPress={() => toggleFavorite(product.id)}
          style={[styles.favoriteIcon, favorites.includes(product.id) && styles.favoriteActive]}
        >
          {favorites.includes(product.id) ? '♥' : '♡'}
        </Text>
      </View>
      <Text style={styles.productName} onPress={() => openDetail(product)}>{product.nombre}</Text>
      <Text style={styles.price}>{formatCOP(product.precio)}</Text>
      <Text style={[styles.stockText, product.stock === 0 && styles.outOfStock]}>
        {product.stock === 0 ? 'Agotado' : `Stock disponible: ${product.stock}`}
      </Text>
      <View style={styles.row}>
        <ActionButton label="Ver detalle" variant="outline" compact onPress={() => openDetail(product)} />
        <ActionButton
          label={product.stock === 0 ? 'Agotado' : 'Agregar'}
          variant="secondary"
          compact
          disabled={product.stock === 0}
          onPress={() => addToCart(product)}
        />
      </View>
    </View>
  );

  const renderCatalogOrFavorites = () => (
    <View>
      <Text style={styles.sectionTitle}>{screen === 'favorites' ? 'Mis favoritos' : 'Encuentra lo que necesitas'}</Text>
      <Text style={styles.sectionSubtitle}>Útiles para estudiar, a precios pensados para ti.</Text>
      <Field label="Buscar productos" value={query} onChangeText={setQuery} placeholder="Ej. cuadernos, tecnología..." />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
        {CATEGORY_FILTERS.map((item) => (
          <Text
            key={item}
            accessibilityRole="button"
            onPress={() => setCategory(item)}
            style={[styles.chip, category === item && styles.chipSelected]}
          >
            {item}
          </Text>
        ))}
      </ScrollView>
      <View style={styles.sortRow}>
        <Text style={styles.smallLabel}>Ordenar por precio:</Text>
        <Text accessibilityRole="button" onPress={() => setSortOrder('asc')} style={[styles.sortButton, sortOrder === 'asc' && styles.sortSelected]}>Menor a mayor</Text>
        <Text accessibilityRole="button" onPress={() => setSortOrder('desc')} style={[styles.sortButton, sortOrder === 'desc' && styles.sortSelected]}>Mayor a menor</Text>
      </View>
      {filteredProducts.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>
            {screen === 'favorites' && !query.trim() && category === 'Todas'
              ? 'Aún no tienes favoritos'
              : query.trim() ? 'No encontramos productos' : 'No hay productos para mostrar'}
          </Text>
          <Text style={styles.muted}>Guarda productos con el corazón para encontrarlos fácilmente.</Text>
          <ActionButton label="Volver al catálogo" onPress={() => goToTab('catalog')} />
        </View>
      ) : (
        <View>{filteredProducts.map(renderProductCard)}</View>
      )}
    </View>
  );

  const renderCart = () => {
    if (!cart.length) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Tu carrito está vacío</Text>
          <Text style={styles.muted}>Explora el catálogo y agrega tus productos favoritos.</Text>
          <ActionButton label="Ir al catálogo" onPress={() => goToTab('catalog')} />
        </View>
      );
    }
    return (
      <View>
        <Text style={styles.sectionTitle}>Tu carrito</Text>
        {cart.map((line) => {
          const product = products.find((item) => item.id === line.productId);
          if (!product) return null;
          return (
            <View key={line.productId} style={styles.card}>
              <Text style={styles.productName}>{product.nombre}</Text>
              <Text style={styles.muted}>{formatCOP(product.precio)} c/u · Stock: {product.stock}</Text>
              <Text style={styles.lineTotal}>Total: {formatCOP(product.precio * line.quantity)}</Text>
              <View style={styles.row}>
                <ActionButton label="−" variant="outline" compact onPress={() => changeQuantity(product, -1)} />
                <Text style={styles.quantityText}>{line.quantity}</Text>
                <ActionButton label="+" variant="outline" compact onPress={() => changeQuantity(product, 1)} />
                <ActionButton label="Eliminar" variant="danger" compact onPress={() => removeFromCart(product.id)} />
              </View>
            </View>
          );
        })}
        <View style={styles.card}>
          <Text style={styles.subheading}>Cupón promocional</Text>
          <Field label="Código de cupón" value={couponInput} onChangeText={setCouponInput} placeholder="BIENVENIDO10" />
          <ActionButton label="Aplicar cupón" variant="outline" onPress={applyCoupon} />
          <View style={styles.separator} />
          <SummaryRows summary={summary} />
          <ActionButton label="Continuar con la compra" onPress={() => {
            setScreen('checkout');
            setActiveTab('cart');
          }} />
        </View>
      </View>
    );
  };

  const renderCheckout = () => (
    <View>
      <Text style={styles.sectionTitle}>Datos para la entrega</Text>
      <Text style={styles.sectionSubtitle}>Revisa tu resumen y completa tus datos para simular el pedido.</Text>
      <View style={styles.card}>
        <Field label="Nombre" value={buyer.nombre} onChangeText={(text) => setBuyer((current) => ({ ...current, nombre: text }))} />
        <Field label="Teléfono" value={buyer.telefono} onChangeText={(text) => setBuyer((current) => ({ ...current, telefono: text }))} keyboardType="phone-pad" />
        <Field label="Municipio" value={buyer.municipio} onChangeText={(text) => setBuyer((current) => ({ ...current, municipio: text }))} placeholder="Mosquera, Madrid o Funza" />
        <Field label="Dirección" value={buyer.direccion} onChangeText={(text) => setBuyer((current) => ({ ...current, direccion: text }))} />
      </View>
      <View style={styles.card}>
        <Text style={styles.subheading}>Resumen de tu pedido</Text>
        {cart.map((line) => {
          const product = products.find((item) => item.id === line.productId);
          return product ? <Text key={line.productId} style={styles.summaryItem}>{line.quantity} × {product.nombre} · {formatCOP(product.precio * line.quantity)}</Text> : null;
        })}
        <View style={styles.separator} />
        <SummaryRows summary={summary} />
      </View>
      <ActionButton label="Confirmar pedido simulado" onPress={confirmPurchase} disabled={!cart.length} />
      <ActionButton label="Volver al carrito" variant="outline" onPress={() => setScreen('cart')} />
    </View>
  );

  // HU15: historial de pedidos confirmados con acceso a su detalle inmutable.
  const renderOrderHistory = () => (
    <View>
      <Text style={styles.sectionTitle}>Historial de pedidos</Text>
      {!orders.length ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Todavía no tienes pedidos</Text>
          <Text style={styles.muted}>Cuando confirmes una compra simulada aparecerá aquí.</Text>
          <ActionButton label="Explorar catálogo" onPress={() => goToTab('catalog')} />
        </View>
      ) : orders.map((order) => (
        <View key={order.code} style={styles.card}>
          <Text style={styles.productName}>{order.code}</Text>
          <Text style={styles.muted}>{new Date(order.createdAt).toLocaleString('es-CO')}</Text>
          <Text style={styles.price}>{formatCOP(order.total)}</Text>
          <ActionButton label="Ver detalle del pedido" variant="outline" compact onPress={() => {
            setSelectedOrderId(order.code);
            setScreen('orderDetail');
          }} />
        </View>
      ))}
    </View>
  );

  const renderOrderDetail = () => (
    <View>
      <Text style={styles.sectionTitle}>Detalle del pedido</Text>
      {selectedOrder ? (
        <View style={styles.card}>
          <Text style={styles.productName}>{selectedOrder.code}</Text>
          <Text style={styles.muted}>{new Date(selectedOrder.createdAt).toLocaleString('es-CO')}</Text>
          <Text style={styles.muted}>Entrega para {selectedOrder.buyer.nombre} · {selectedOrder.buyer.municipio}</Text>
          <View style={styles.separator} />
          {selectedOrder.items.map((item) => (
            <Text key={item.productId} style={styles.summaryItem}>
              {item.cantidad} × {item.nombre} · {formatCOP(item.precioUnitario)} c/u · {formatCOP(item.totalLinea)}
            </Text>
          ))}
          <View style={styles.separator} />
          <SummaryRows summary={selectedOrder} />
        </View>
      ) : <Text style={styles.muted}>No se encontró este pedido.</Text>}
      <ActionButton label="Volver al historial" variant="outline" onPress={() => setScreen('history')} />
    </View>
  );

  const renderProductDetail = () => {
    if (!selectedProduct) {
      return <View style={styles.emptyState}><Text style={styles.emptyTitle}>Producto no disponible</Text><ActionButton label="Volver al catálogo" onPress={() => goToTab('catalog')} /></View>;
    }
    // HU07: la vista detalla producto, disponibilidad y acciones sin reiniciar la sesión.
    const reviews = selectedProduct.reviews || [];
    const average = reviews.length
      ? (reviews.reduce((sum, vote) => sum + vote, 0) / reviews.length).toFixed(1)
      : 'Sin calificaciones';
    return (
      <View>
        <Text style={styles.categoryLabel}>{selectedProduct.categoria}</Text>
        <Text style={styles.sectionTitle}>{selectedProduct.nombre}</Text>
        <View style={styles.card}>
          <Text style={styles.price}>{formatCOP(selectedProduct.precio)}</Text>
          <Text style={[styles.stockText, selectedProduct.stock === 0 && styles.outOfStock]}>
            {selectedProduct.stock === 0 ? 'Agotado' : `Stock disponible: ${selectedProduct.stock}`}
          </Text>
          <Text style={styles.description}>{selectedProduct.descripcion}</Text>
          <View style={styles.row}>
            <ActionButton
              label={selectedProduct.stock === 0 ? 'Agotado' : 'Agregar al carrito'}
              variant="secondary"
              disabled={selectedProduct.stock === 0}
              onPress={() => addToCart(selectedProduct)}
            />
            <ActionButton
              label={favorites.includes(selectedProduct.id) ? '♥ Favorito' : '♡ Favorito'}
              variant="outline"
              onPress={() => toggleFavorite(selectedProduct.id)}
            />
          </View>
        </View>
        <View style={styles.card}>
          <Text style={styles.subheading}>Reseñas de estudiantes</Text>
          <Text style={styles.reviewText}>★ {average} · {reviews.length} {reviews.length === 1 ? 'voto' : 'votos'}</Text>
          <Field label="Calificación (1 a 5)" value={ratingInput} onChangeText={setRatingInput} keyboardType="number-pad" placeholder="5" />
          <ActionButton label="Enviar calificación" variant="outline" onPress={submitReview} />
        </View>
        <ActionButton label="Volver" onPress={() => setScreen(activeTab === 'favorites' ? 'favorites' : 'catalog')} />
      </View>
    );
  };

  const renderSeller = () => (
    <View>
      <Text style={styles.sectionTitle}>Panel Vendedor</Text>
      <Text style={styles.sectionSubtitle}>Administración simulada del catálogo Kipus.</Text>
      <View style={styles.card}>
        <Text style={styles.subheading}>{editingProductId ? `Editar ${editingProductId}` : 'Crear producto'}</Text>
        <Field label="Nombre" value={sellerForm.nombre} onChangeText={(text) => setSellerForm((current) => ({ ...current, nombre: text }))} />
        <Text style={styles.fieldLabel}>Categoría</Text>
        <View style={styles.wrapRow}>
          {CATEGORIES.map((item) => (
            <Text key={item} onPress={() => setSellerForm((current) => ({ ...current, categoria: item }))} style={[styles.chip, sellerForm.categoria === item && styles.chipSelected]}>{item}</Text>
          ))}
        </View>
        <Field label="Precio entero (COP)" value={sellerForm.precio} onChangeText={(text) => setSellerForm((current) => ({ ...current, precio: text }))} keyboardType="number-pad" />
        <Field label="Stock entero" value={sellerForm.stock} onChangeText={(text) => setSellerForm((current) => ({ ...current, stock: text }))} keyboardType="number-pad" />
        <Field label="Descripción (mínimo 15 caracteres)" value={sellerForm.descripcion} onChangeText={(text) => setSellerForm((current) => ({ ...current, descripcion: text }))} multiline />
        <ActionButton label={editingProductId ? 'Guardar cambios' : 'Crear producto'} onPress={saveSellerProduct} />
        {editingProductId ? <ActionButton label="Cancelar edición" variant="outline" onPress={() => {
          setEditingProductId(null);
          setSellerForm({ nombre: '', categoria: CATEGORIES[0], precio: '', stock: '', descripcion: '' });
        }} /> : null}
      </View>
      <Text style={styles.subheading}>Productos registrados ({products.length})</Text>
      {products.map((product) => (
        <View key={product.id} style={styles.listRow}>
          <View style={styles.listInfo}>
            <Text style={styles.productName}>{product.nombre}</Text>
            <Text style={styles.muted}>{product.id} · Stock: {product.stock}</Text>
          </View>
          <ActionButton label="Editar" variant="outline" compact onPress={() => startEditingProduct(product)} />
        </View>
      ))}
    </View>
  );

  const renderContent = () => {
    if (screen === 'catalog' || screen === 'favorites') return renderCatalogOrFavorites();
    if (screen === 'detail') return renderProductDetail();
    if (screen === 'cart') return renderCart();
    if (screen === 'checkout') return renderCheckout();
    if (screen === 'history') return renderOrderHistory();
    if (screen === 'orderDetail') return renderOrderDetail();
    if (screen === 'seller') return renderSeller();
    return null;
  };

  // HU02: navegación persistente entre las cinco secciones principales y contador derivado del carrito.
  const navItems = [
    { key: 'catalog', label: 'Catálogo' },
    { key: 'favorites', label: 'Favoritos' },
    { key: 'cart', label: `Carrito${cartCount ? ` (${cartCount})` : ''}` },
    { key: 'history', label: 'Historial' },
    { key: 'seller', label: 'Vendedor' },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" backgroundColor={BLUE} />
      <View style={styles.brandHeader}>
        <Text style={styles.brandName}>Kipus</Text>
        <Text style={styles.tagline}>Organiza tu semestre, cuida tu bolsillo.</Text>
      </View>
      {banner ? (
        <Text accessibilityRole="alert" onPress={() => setBanner('')} style={styles.banner}>{banner}  ×</Text>
      ) : null}
      <ScrollView style={styles.page} contentContainerStyle={styles.pageContent} keyboardShouldPersistTaps="handled">
        {hydrated ? renderContent() : <Text style={styles.muted}>Cargando Kipus...</Text>}
      </ScrollView>
      <ScrollView horizontal style={styles.bottomNav} contentContainerStyle={styles.navContent} showsHorizontalScrollIndicator={false}>
        {navItems.map((item) => (
          <Text
            key={item.key}
            accessibilityRole="button"
            onPress={() => goToTab(item.key)}
            style={[styles.navItem, activeTab === item.key && styles.navItemActive]}
          >
            {item.label}
          </Text>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryRows({ summary }) {
  const shippingLabel = summary.shipping === 0 && summary.subtotal > 0 ? 'Envío Gratis' : formatCOP(summary.shipping);
  return (
    <View>
      <View style={styles.summaryRow}><Text style={styles.muted}>Subtotal</Text><Text style={styles.summaryValue}>{formatCOP(summary.subtotal)}</Text></View>
      <View style={styles.summaryRow}><Text style={styles.muted}>Descuento</Text><Text style={styles.summaryValue}>− {formatCOP(summary.discount)}</Text></View>
      <View style={styles.summaryRow}><Text style={styles.muted}>Envío</Text><Text style={styles.summaryValue}>{shippingLabel}</Text></View>
      <View style={[styles.summaryRow, styles.totalRow]}><Text style={styles.totalLabel}>Total</Text><Text style={styles.totalLabel}>{formatCOP(summary.total)}</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  brandHeader: { backgroundColor: BLUE, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 15 },
  brandName: { color: '#FFFFFF', fontSize: 28, fontWeight: '800', letterSpacing: 0.5 },
  tagline: { color: '#DBEAFE', fontSize: 13, marginTop: 2 },
  banner: { backgroundColor: '#FFF7ED', color: '#9A3412', paddingHorizontal: 16, paddingVertical: 11, fontSize: 13, borderBottomWidth: 1, borderBottomColor: '#FED7AA' },
  page: { flex: 1 },
  pageContent: { padding: 16, paddingBottom: 28 },
  sectionTitle: { color: '#0F172A', fontSize: 22, fontWeight: '800', marginBottom: 6 },
  sectionSubtitle: { color: '#64748B', fontSize: 14, marginBottom: 16, lineHeight: 20 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 },
  categoryLabel: { color: BLUE, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  favoriteIcon: { color: '#64748B', fontSize: 26, lineHeight: 29, paddingHorizontal: 4 },
  favoriteActive: { color: '#E11D48' },
  productName: { color: '#0F172A', fontSize: 16, lineHeight: 22, fontWeight: '700', marginBottom: 6 },
  price: { color: ORANGE, fontSize: 18, fontWeight: '800', marginVertical: 3 },
  stockText: { color: '#475569', fontSize: 13, marginTop: 4, marginBottom: 12 },
  outOfStock: { color: '#B91C1C', fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  button: { overflow: 'hidden', backgroundColor: BLUE, color: '#FFFFFF', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12, textAlign: 'center', fontSize: 14, fontWeight: '700', marginBottom: 8 },
  buttonSecondary: { backgroundColor: ORANGE },
  buttonOutline: { backgroundColor: '#FFFFFF', color: BLUE, borderWidth: 1, borderColor: BLUE },
  buttonDanger: { backgroundColor: '#B91C1C' },
  buttonDisabled: { backgroundColor: '#CBD5E1', color: '#64748B', borderColor: '#CBD5E1' },
  buttonCompact: { paddingHorizontal: 12, paddingVertical: 9, marginBottom: 0, minWidth: 68 },
  fieldWrap: { marginBottom: 12 },
  fieldLabel: { color: '#334155', fontSize: 13, fontWeight: '700', marginBottom: 6 },
  input: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, color: '#0F172A' },
  multilineInput: { minHeight: 88, textAlignVertical: 'top' },
  chipScroll: { marginVertical: 12, flexGrow: 0 },
  chip: { overflow: 'hidden', color: '#334155', backgroundColor: '#FFFFFF', borderColor: '#CBD5E1', borderWidth: 1, borderRadius: 20, paddingHorizontal: 13, paddingVertical: 8, marginRight: 7, marginBottom: 7, fontSize: 13, fontWeight: '600' },
  chipSelected: { color: '#FFFFFF', backgroundColor: BLUE, borderColor: BLUE },
  sortRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 7, marginBottom: 14 },
  smallLabel: { color: '#64748B', fontSize: 12, marginRight: 2 },
  sortButton: { overflow: 'hidden', color: BLUE, backgroundColor: '#FFFFFF', borderColor: '#CBD5E1', borderWidth: 1, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 7, fontSize: 11, fontWeight: '600' },
  sortSelected: { color: '#FFFFFF', backgroundColor: BLUE, borderColor: BLUE },
  emptyState: { backgroundColor: '#FFFFFF', borderRadius: 16, alignItems: 'center', padding: 24, marginTop: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  emptyTitle: { color: '#0F172A', fontSize: 18, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  muted: { color: '#64748B', fontSize: 13, lineHeight: 19, marginBottom: 8 },
  subheading: { color: '#0F172A', fontWeight: '800', fontSize: 16, marginBottom: 10 },
  separator: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 12 },
  quantityText: { color: '#0F172A', fontWeight: '800', minWidth: 24, textAlign: 'center' },
  lineTotal: { color: '#0F172A', fontSize: 14, fontWeight: '700', marginTop: 5 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
  summaryValue: { color: '#334155', fontSize: 13, fontWeight: '600' },
  totalRow: { borderTopWidth: 1, borderTopColor: '#E2E8F0', marginTop: 5, paddingTop: 11 },
  totalLabel: { color: '#0F172A', fontSize: 16, fontWeight: '800' },
  summaryItem: { color: '#334155', fontSize: 13, lineHeight: 20, marginBottom: 7 },
  description: { color: '#334155', fontSize: 15, lineHeight: 23, marginVertical: 12 },
  reviewText: { color: '#B45309', fontSize: 15, fontWeight: '700', marginBottom: 10 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 5, marginBottom: 12 },
  listRow: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#E2E8F0' },
  listInfo: { flex: 1, paddingRight: 8 },
  bottomNav: { flexGrow: 0, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E2E8F0', maxHeight: 62 },
  navContent: { alignItems: 'center', paddingHorizontal: 5, paddingVertical: 7 },
  navItem: { overflow: 'hidden', color: '#475569', fontSize: 12, fontWeight: '700', paddingHorizontal: 12, paddingVertical: 11, borderRadius: 9, marginHorizontal: 2 },
  navItemActive: { color: '#FFFFFF', backgroundColor: BLUE },
});
