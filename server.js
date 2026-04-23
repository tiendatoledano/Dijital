const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Servir archivos estáticos desde public Y desde la raíz
app.use(express.static('public'));
app.use(express.static('.'));  // ← CORREGIDO: permite servir index.html y admin.html
app.use('/uploads', express.static('public/uploads'));

// Crear carpetas necesarias
const dirs = ['./data', './public/uploads'];
dirs.forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Configuración de Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, './public/uploads'),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

// ===========================================
// CONFIGURACIÓN POR DEFECTO
// ===========================================

const CATEGORIAS_DEFAULT = {
    electro: ['refrigeradores', 'lavadoras', 'neveras', 'televisores', 'climas', 'aires', 'otros'],
    dulces: ['pasteles', 'cupcakes', 'tortas', 'galletas', 'postres', 'otros']
};

const DEFAULT_STORE_CONFIG = {
    envio: {
        disponible: true,
        costo: 0,
        tiempo_estimado: "24-48 horas",
        cobertura: "Toda la ciudad"
    },
    garantia: {
        disponible: true,
        duracion: "12 meses",
        descripcion: "Garantía contra defectos de fabricación"
    },
    metodos_pago: ["Efectivo", "Transferencia"],
    datos_bancarios: {
        numero_tarjeta: "",
        whatsapp_confirmacion: ""
    },
    contacto: {
        telefono: "+53 5XXXXXXX",
        email: "contacto@tiendalareina.com"
    }
};

// ===========================================
// FUNCIÓN PARA GENERAR CÓDIGO ÚNICO
// ===========================================

function generarCodigoUnico() {
    const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let codigo = '';
    for (let i = 0; i < 8; i++) {
        codigo += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
    }
    const timestamp = Date.now().toString(36).slice(-4).toUpperCase();
    return `${codigo}${timestamp}`;
}

// ===========================================
// HELPERS - TIENDAS
// ===========================================

const getTiendas = () => {
    const filePath = './data/tiendas.json';
    if (!fs.existsSync(filePath)) {
        const defaultTiendas = [
            { 
                id: 'electro', 
                nombre: '⚡ Electrodomésticos', 
                icono: '⚡', 
                descripcion: 'Tecnología para tu hogar',
                configuracion: DEFAULT_STORE_CONFIG,
                categorias: CATEGORIAS_DEFAULT.electro 
            },
            { 
                id: 'dulces', 
                nombre: '🍰 Dulcería FG-Studio', 
                icono: '🍰', 
                descripcion: 'Delicias artesanales',
                configuracion: DEFAULT_STORE_CONFIG,
                categorias: CATEGORIAS_DEFAULT.dulces 
            }
        ];
        fs.writeFileSync(filePath, JSON.stringify(defaultTiendas, null, 2));
        return defaultTiendas;
    }
    return JSON.parse(fs.readFileSync(filePath));
};

const saveTiendas = (data) => {
    fs.writeFileSync('./data/tiendas.json', JSON.stringify(data, null, 2));
};

const getTiendaById = (id) => {
    const tiendas = getTiendas();
    return tiendas.find(t => t.id === id);
};

// ===========================================
// HELPERS - CATEGORÍAS
// ===========================================

const getCategorias = (tienda) => {
    const filePath = `./data/categorias_${tienda}.json`;
    const tiendaInfo = getTiendaById(tienda);
    
    if (!fs.existsSync(filePath)) {
        const defaultCats = tiendaInfo?.categorias || ['otros'];
        fs.writeFileSync(filePath, JSON.stringify(defaultCats, null, 2));
        return defaultCats;
    }
    return JSON.parse(fs.readFileSync(filePath));
};

const saveCategorias = (tienda, data) => {
    fs.writeFileSync(`./data/categorias_${tienda}.json`, JSON.stringify(data, null, 2));
};

const limpiarCategoriasVacias = (tienda) => {
    const productos = getProductos(tienda);
    const categoriasUsadas = [...new Set(productos.map(p => p.categoria || 'otros'))];
    let categorias = getCategorias(tienda);
    
    categorias = categorias.filter(c => categoriasUsadas.includes(c));
    
    if (categorias.length === 0) {
        categorias = ['otros'];
    }
    
    saveCategorias(tienda, categorias);
    return categorias;
};

// ===========================================
// HELPERS - PRODUCTOS
// ===========================================

const getProductos = (tienda) => {
    const filePath = `./data/productos_${tienda}.json`;
    if (!fs.existsSync(filePath)) {
        let ejemplo = [];
        
        if (tienda === 'electro') {
            ejemplo = [
                { id: 1, nombre: "Refrigerador LG Inverter", descripcion: "Tecnología Inverter de ahorro energético. Capacidad de 400L con dispensador de agua y hielo.", precio: 950, descuento: 0, imagen: "https://images.unsplash.com/photo-1581091226033-d5c48150dbaa?w=400", disponible: true, tamanio: "grande", categoria: "refrigeradores" },
                { id: 2, nombre: "Samsung Side by Side", descripcion: "Capacidad de 600L con dispensador de agua y hielo. Tecnología No Frost.", precio: 900, descuento: 5, imagen: "https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?w=400", disponible: true, tamanio: "grande", categoria: "refrigeradores" },
                { id: 3, nombre: "Lavadora Milexus 15kg", descripcion: "Carga superior, automática con múltiples programas de lavado.", precio: 750, descuento: 0, imagen: "https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?w=400", disponible: true, tamanio: "grande", categoria: "lavadoras" },
                { id: 4, nombre: "Smart TV Samsung 55\"", descripcion: "Televisor 4K UHD con sistema operativo Tizen. HDR10+.", precio: 1200, descuento: 10, imagen: "https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=400", disponible: true, tamanio: "grande", categoria: "televisores" },
                { id: 5, nombre: "Clima Inverter 12000 BTU", descripcion: "Aire acondicionado split con tecnología inverter.", precio: 850, descuento: 0, imagen: "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=400", disponible: true, tamanio: "grande", categoria: "climas" }
            ];
        } else if (tienda === 'dulces') {
            ejemplo = [
                { id: 1, nombre: "Pastel de Chocolate", descripcion: "Delicioso pastel de chocolate con ganache y frutos rojos.", precio: 500, descuento: 10, imagen: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400", disponible: true, tamanio: "pequeno", categoria: "pasteles" },
                { id: 2, nombre: "Cupcakes Variados (6u)", descripcion: "Surtido de 6 cupcakes con diferentes sabores.", precio: 350, descuento: 0, imagen: "https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=400", disponible: true, tamanio: "pequeno", categoria: "cupcakes" },
                { id: 3, nombre: "Torta de Cumpleaños", descripcion: "Torta de tres pisos personalizada.", precio: 800, descuento: 5, imagen: "https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=400", disponible: true, tamanio: "grande", categoria: "tortas" },
                { id: 4, nombre: "Galletas Decoradas (12u)", descripcion: "Galletas de mantequilla con glaseado real.", precio: 250, descuento: 0, imagen: "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400", disponible: true, tamanio: "pequeno", categoria: "galletas" },
                { id: 5, nombre: "Cheesecake de Fresa", descripcion: "Cheesecake cremoso con cobertura de fresas.", precio: 450, descuento: 0, imagen: "https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=400", disponible: true, tamanio: "pequeno", categoria: "postres" }
            ];
        } else {
            ejemplo = [
                { id: 1, nombre: "Producto Ejemplo", descripcion: "Descripción del producto de ejemplo.", precio: 100, descuento: 0, imagen: "https://via.placeholder.com/400", disponible: true, tamanio: "pequeno", categoria: "otros" }
            ];
        }
        
        fs.writeFileSync(filePath, JSON.stringify(ejemplo, null, 2));
        return ejemplo;
    }
    return JSON.parse(fs.readFileSync(filePath));
};

const saveProductos = (tienda, data) => {
    fs.writeFileSync(`./data/productos_${tienda}.json`, JSON.stringify(data, null, 2));
    limpiarCategoriasVacias(tienda);
};

// ===========================================
// HELPERS - PEDIDOS
// ===========================================

const getPedidos = (tienda = null) => {
    const filePath = './data/pedidos.json';
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify([], null, 2));
        return [];
    }
    const pedidos = JSON.parse(fs.readFileSync(filePath));
    if (tienda) {
        return pedidos.filter(p => p.tienda === tienda);
    }
    return pedidos;
};

const savePedidos = (data) => {
    fs.writeFileSync('./data/pedidos.json', JSON.stringify(data, null, 2));
};

const getNextOrderId = (tienda) => {
    const counterPath = './data/order_counters.json';
    let counters = {};
    if (fs.existsSync(counterPath)) {
        counters = JSON.parse(fs.readFileSync(counterPath));
    }
    if (!counters[tienda]) counters[tienda] = 0;
    counters[tienda]++;
    fs.writeFileSync(counterPath, JSON.stringify(counters, null, 2));
    return counters[tienda];
};

const resetOrderCounter = (tienda) => {
    const counterPath = './data/order_counters.json';
    if (fs.existsSync(counterPath)) {
        let counters = JSON.parse(fs.readFileSync(counterPath));
        if (tienda && counters[tienda] !== undefined) {
            counters[tienda] = 0;
            fs.writeFileSync(counterPath, JSON.stringify(counters, null, 2));
        }
    }
};

// ===========================================
// HELPERS - CONFIGURACIÓN
// ===========================================

const getConfig = () => {
    const filePath = './data/config.json';
    if (!fs.existsSync(filePath)) {
        const defaultConfig = { monedaBase: "CUP", tasas: { CUP: 1, USD: 0.04, EUR: 0.037 } };
        fs.writeFileSync(filePath, JSON.stringify(defaultConfig, null, 2));
        return defaultConfig;
    }
    return JSON.parse(fs.readFileSync(filePath));
};

// ===========================================
// MIDDLEWARE DE AUTENTICACIÓN
// ===========================================

const AUTH = (req, res, next) => {
    const pass = req.headers['admin-password'] || req.query.password;
    if (pass === '1988') {
        next();
    } else {
        res.status(401).json({ error: 'No autorizado' });
    }
};

// ===========================================
// API PÚBLICA
// ===========================================

app.get('/api/status', (req, res) => {
    res.json({ online: true, timestamp: new Date().toISOString() });
});

app.get('/api/tiendas', (req, res) => {
    const tiendas = getTiendas();
    res.json(tiendas.map(t => t.id));
});

app.get('/api/tiendas/info', (req, res) => {
    res.json(getTiendas());
});

app.get('/api/tiendas/:id', (req, res) => {
    const tienda = getTiendaById(req.params.id);
    if (!tienda) return res.status(404).json({ error: 'Tienda no encontrada' });
    res.json(tienda);
});

app.get('/api/tiendas/:id/config', (req, res) => {
    const tienda = getTiendaById(req.params.id);
    if (!tienda) return res.status(404).json({ error: 'Tienda no encontrada' });
    res.json(tienda.configuracion || DEFAULT_STORE_CONFIG);
});

app.get('/api/productos', (req, res) => {
    const tienda = req.query.tienda || 'electro';
    const tiendaInfo = getTiendaById(tienda);
    if (!tiendaInfo) return res.status(400).json({ error: 'Tienda no válida' });
    res.json(getProductos(tienda));
});

app.get('/api/categorias', (req, res) => {
    const tienda = req.query.tienda || 'electro';
    const tiendaInfo = getTiendaById(tienda);
    if (!tiendaInfo) return res.status(400).json({ error: 'Tienda no válida' });
    const categorias = limpiarCategoriasVacias(tienda);
    res.json(categorias);
});

app.get('/api/config', (req, res) => {
    res.json(getConfig());
});

app.post('/api/pedidos', (req, res) => {
    try {
        const tienda = req.body.tienda || 'electro';
        const tiendaInfo = getTiendaById(tienda);
        if (!tiendaInfo) return res.status(400).json({ error: 'Tienda no válida' });
        
        const metodoPago = req.body.metodoPago || 'Efectivo';
        
        if (metodoPago === 'Transferencia') {
            const numeroTarjeta = tiendaInfo.configuracion?.datos_bancarios?.numero_tarjeta;
            if (!numeroTarjeta || numeroTarjeta.trim() === '') {
                return res.status(400).json({ 
                    error: 'Transferencia no disponible',
                    mensaje: 'Esta tienda no tiene configurado el número de tarjeta para transferencias.'
                });
            }
        }
        
        const todosPedidos = getPedidos();
        const codigoCliente = generarCodigoUnico();
        
        const nuevoPedido = {
            id: getNextOrderId(tienda),
            codigoCliente: codigoCliente,
            fecha: new Date().toISOString(),
            estado: 'pendiente',
            tienda: tienda,
            nombre: req.body.nombre,
            telefono: req.body.telefono,
            direccion: req.body.direccion,
            items: req.body.items || [],
            total: req.body.total || 0,
            moneda: req.body.moneda || 'CUP',
            metodoPago: metodoPago
        };
        todosPedidos.push(nuevoPedido);
        savePedidos(todosPedidos);
        console.log(`✅ Pedido #${nuevoPedido.id} creado | Código: ${codigoCliente}`);
        res.json({ 
            success: true, 
            orderId: nuevoPedido.id,
            codigoCliente: codigoCliente
        });
    } catch (e) {
        console.error('Error al crear pedido:', e);
        res.status(500).json({ error: 'Error interno' });
    }
});

// ===========================================
// API ADMIN - TIENDAS
// ===========================================

app.get('/api/admin/tiendas', AUTH, (req, res) => {
    res.json(getTiendas());
});

app.get('/api/admin/tiendas/:id', AUTH, (req, res) => {
    const tienda = getTiendaById(req.params.id);
    if (!tienda) return res.status(404).json({ error: 'Tienda no encontrada' });
    res.json(tienda);
});

app.post('/api/admin/tiendas', AUTH, (req, res) => {
    const { id, nombre, descripcion, categorias, icono, configuracion } = req.body;
    
    if (!id || !nombre) {
        return res.status(400).json({ error: 'ID y Nombre son requeridos' });
    }
    
    const tiendas = getTiendas();
    if (tiendas.find(t => t.id === id)) {
        return res.status(400).json({ error: 'Ya existe una tienda con ese ID' });
    }
    
    const nuevaTienda = {
        id: id.toLowerCase().trim(),
        nombre: nombre.trim(),
        icono: icono || '🛒',
        descripcion: descripcion?.trim() || '',
        configuracion: configuracion || DEFAULT_STORE_CONFIG,
        categorias: Array.isArray(categorias) ? categorias : (categorias ? categorias.split(',').map(c => c.trim()) : ['otros'])
    };
    
    tiendas.push(nuevaTienda);
    saveTiendas(tiendas);
    
    saveCategorias(nuevaTienda.id, nuevaTienda.categorias);
    saveProductos(nuevaTienda.id, []);
    
    res.json({ success: true, tienda: nuevaTienda });
});

app.put('/api/admin/tiendas/:id', AUTH, (req, res) => {
    const { nombre, descripcion, categorias, icono, configuracion } = req.body;
    const tiendas = getTiendas();
    const index = tiendas.findIndex(t => t.id === req.params.id);
    
    if (index === -1) {
        return res.status(404).json({ error: 'Tienda no encontrada' });
    }
    
    tiendas[index] = {
        ...tiendas[index],
        nombre: nombre?.trim() || tiendas[index].nombre,
        icono: icono || tiendas[index].icono || '🛒',
        descripcion: descripcion?.trim() || tiendas[index].descripcion,
        configuracion: configuracion || tiendas[index].configuracion || DEFAULT_STORE_CONFIG,
        categorias: Array.isArray(categorias) ? categorias : (categorias ? categorias.split(',').map(c => c.trim()) : tiendas[index].categorias)
    };
    
    saveTiendas(tiendas);
    res.json({ success: true, tienda: tiendas[index] });
});

app.delete('/api/admin/tiendas/:id', AUTH, (req, res) => {
    const id = req.params.id;
    let tiendas = getTiendas();
    tiendas = tiendas.filter(t => t.id !== id);
    saveTiendas(tiendas);
    
    try { fs.unlinkSync(`./data/productos_${id}.json`); } catch(e) {}
    try { fs.unlinkSync(`./data/categorias_${id}.json`); } catch(e) {}
    
    const pedidos = getPedidos().filter(p => p.tienda !== id);
    savePedidos(pedidos);
    resetOrderCounter(id);
    
    res.json({ success: true });
});

// ===========================================
// API ADMIN - CATEGORÍAS
// ===========================================

app.get('/api/admin/categorias', AUTH, (req, res) => {
    const tienda = req.query.tienda || 'electro';
    res.json(getCategorias(tienda));
});

app.post('/api/admin/categorias', AUTH, (req, res) => {
    const { tienda, categoria } = req.body;
    if (!tienda || !categoria) return res.status(400).json({ error: 'Faltan datos' });
    
    const categorias = getCategorias(tienda);
    if (!categorias.includes(categoria)) {
        categorias.push(categoria);
        saveCategorias(tienda, categorias);
    }
    res.json({ success: true, categorias });
});

app.delete('/api/admin/categorias', AUTH, (req, res) => {
    const { tienda, categoria } = req.body;
    if (!tienda || !categoria) return res.status(400).json({ error: 'Faltan datos' });
    
    let categorias = getCategorias(tienda);
    categorias = categorias.filter(c => c !== categoria);
    saveCategorias(tienda, categorias);
    res.json({ success: true, categorias });
});

// ===========================================
// API ADMIN - PRODUCTOS
// ===========================================

app.get('/api/admin/productos', AUTH, (req, res) => {
    const tienda = req.query.tienda || 'electro';
    res.json(getProductos(tienda));
});

app.post('/api/admin/productos', AUTH, upload.single('imagen'), (req, res) => {
    const tienda = req.body.tienda;
    const prods = getProductos(tienda);
    
    const nuevo = {
        id: Date.now(),
        nombre: req.body.nombre,
        descripcion: req.body.descripcion || '',
        precio: Number(req.body.precio),
        descuento: Number(req.body.descuento) || 0,
        imagen: req.file ? `/uploads/${req.file.filename}` : (req.body.imagen_url || 'https://via.placeholder.com/400'),
        disponible: req.body.disponible === 'true',
        tamanio: req.body.tamanio || 'pequeno',
        categoria: req.body.categoria || 'otros'
    };
    
    prods.push(nuevo);
    saveProductos(tienda, prods);
    res.json({ success: true, producto: nuevo });
});

app.put('/api/admin/productos/:id', AUTH, upload.single('imagen'), (req, res) => {
    const tienda = req.body.tienda;
    let prods = getProductos(tienda);
    const idx = prods.findIndex(p => p.id == req.params.id);
    
    if (idx !== -1) {
        prods[idx] = {
            ...prods[idx],
            nombre: req.body.nombre,
            descripcion: req.body.descripcion || prods[idx].descripcion,
            precio: Number(req.body.precio),
            descuento: Number(req.body.descuento) || 0,
            disponible: req.body.disponible === 'true',
            tamanio: req.body.tamanio || prods[idx].tamanio,
            categoria: req.body.categoria || prods[idx].categoria,
            imagen: req.file ? `/uploads/${req.file.filename}` : (req.body.imagen_url || prods[idx].imagen)
        };
        saveProductos(tienda, prods);
    }
    res.json({ success: true });
});

app.delete('/api/admin/productos/:id', AUTH, (req, res) => {
    const tienda = req.query.tienda;
    let prods = getProductos(tienda);
    const id = parseInt(req.params.id);
    prods = prods.filter(p => p.id !== id);
    saveProductos(tienda, prods);
    res.json({ success: true });
});

// ===========================================
// API ADMIN - PEDIDOS
// ===========================================

app.get('/api/admin/pedidos', AUTH, (req, res) => {
    const tienda = req.query.tienda || null;
    let pedidos = getPedidos(tienda);
    pedidos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    res.json(pedidos);
});

app.put('/api/admin/pedidos/:id', AUTH, (req, res) => {
    let pedidos = getPedidos();
    const idx = pedidos.findIndex(p => p.id == req.params.id && p.tienda === req.body.tienda);
    if (idx !== -1) {
        pedidos[idx].estado = req.body.estado;
        savePedidos(pedidos);
    }
    res.json({ success: true });
});

app.delete('/api/admin/pedidos/:id', AUTH, (req, res) => {
    let pedidos = getPedidos();
    const { tienda } = req.query;
    const id = parseInt(req.params.id);
    const pedidosRestantes = pedidos.filter(p => !(p.id === id && p.tienda === tienda));
    savePedidos(pedidosRestantes);
    
    const quedanPedidosDeTienda = pedidosRestantes.some(p => p.tienda === tienda);
    if (!quedanPedidosDeTienda) {
        resetOrderCounter(tienda);
    }
    
    res.json({ success: true });
});

app.delete('/api/admin/pedidos', AUTH, (req, res) => {
    const tienda = req.query.tienda;
    let pedidos = getPedidos();
    if (tienda) {
        pedidos = pedidos.filter(p => p.tienda !== tienda);
        resetOrderCounter(tienda);
    } else {
        pedidos = [];
        const countersPath = './data/order_counters.json';
        if (fs.existsSync(countersPath)) {
            fs.writeFileSync(countersPath, JSON.stringify({}, null, 2));
        }
    }
    savePedidos(pedidos);
    res.json({ success: true });
});

// ===========================================
// API ADMIN - CONFIGURACIÓN
// ===========================================

app.get('/api/admin/config', AUTH, (req, res) => {
    res.json(getConfig());
});

app.put('/api/admin/config', AUTH, (req, res) => {
    fs.writeFileSync('./data/config.json', JSON.stringify(req.body, null, 2));
    res.json({ success: true });
});

// ===========================================
// INICIAR SERVIDOR
// ===========================================

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Tienda La Reina - Servidor Multi-Tienda`);
    console.log(`═══════════════════════════════════════════════════`);
    console.log(`🛍️  Tienda: http://localhost:${PORT}`);
    console.log(`👑 Admin: http://localhost:${PORT}/admin.html`);
    console.log(`🔑 Contraseña: 1988`);
    console.log(`═══════════════════════════════════════════════════\n`);
});

server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
        console.error(`\n❌ ERROR: Puerto ${PORT} ocupado.`);
        console.error(`📌 Solución: Cierra el proceso o usa otro puerto.\n`);
        process.exit(1);
    } else {
        console.error('Error:', e);
        process.exit(1);
    }
});