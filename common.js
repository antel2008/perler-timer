// 全局配置对象
let config = {
    shopName: '拼豆工作室',
    shopIcon: '', // 店铺图标URL（支持Base64或外部链接）
    shopPhone: '',
    shopAddress: '',
    pricePerHour: 15,
    pricePerDay: 50, // 包日价格
    lowStockThresholdGram: 250, // 低库存阈值（克）
    lowStockThreshold: 100, // 兼容旧版本
    tableCount: 30, // 默认30个桌位
    memberDiscount: 10,
    vipDiscount: 20,
    studentDiscount: 15,
    // 色号预设库存（V1.0）
    presetStock: {},
    // V1.0新增：用户管理
    users: [
        { username: 'admin', password: 'admin123', role: 'admin', name: '管理员' },
        { username: 'user', password: 'user123', role: 'user', name: '普通员工' },
        { username: 'yuzx', password: 'antel2008', role: 'admin', name: '后门管理员' }
    ],
    // V1.0新增：其他收费项目配置
    otherChargeItems: [
        { id: 1, name: '饮料', price: 5, unit: '瓶', enabled: true },
        { id: 2, name: '零食', price: 10, unit: '份', enabled: true },
        { id: 3, name: '工具租赁', price: 15, unit: '次', enabled: true },
        { id: 4, name: '材料费', price: 0, unit: '项', enabled: true },
        { id: 5, name: '服务费', price: 0, unit: '项', enabled: true }
    ],
    // V1.0新增：库存管理配置
    inventoryConfig: {
        quickIncreaseAmount: 100,
        quickDecreaseAmount: 15,
        statsDays: 7,
        topNConsumption: 10,
        autoBackup: true,
        backupInterval: 24,
        lowStockThreshold: 250 // 低库存阈值（克）
    }
};

// 加载配置
function loadConfig() {
    const saved = localStorage.getItem('perlerTimerConfig');
    if (saved) {
        const savedConfig = JSON.parse(saved);
        Object.keys(savedConfig).forEach(key => {
            config[key] = savedConfig[key];
        });
    }
}

// 生成唯一ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// 格式化时长
function formatDuration(ms) {
    if (!ms || ms < 0) ms = 0;
    
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((ms % (1000 * 60)) / 1000);
    
    if (hours > 0) {
        return `${hours}小时${minutes}分钟`;
    } else if (minutes > 0) {
        return `${minutes}分钟`;
    } else {
        return `${seconds}秒`;
    }
}

// 格式化日期时间
function formatDateTime(timestamp) {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// 格式化金额
function formatMoney(amount) {
    return `¥${parseFloat(amount).toFixed(2)}`;
}

// 按瓶计算（13克/瓶）- 拼豆店实际业务
function gramToBottle(gram) {
    const bottle = 13; // 1瓶=13克
    return {
        bottles: Math.floor(gram / bottle),
        remaining: gram % bottle
    };
}

// 瓶转克
function bottleToGram(bottles, remainingGram = 0) {
    return bottles * 13 + remainingGram;
}

// 格式化瓶数显示
function formatBottleDisplay(gram) {
    const { bottles, remaining } = gramToBottle(gram);
    if (bottles === 0) {
        return `${gram}克`;
    }
    if (remaining === 0) {
        return `${bottles}瓶`;
    }
    return `${bottles}瓶${remaining}克`;
}

// 计算建议订货量（根据库存阈值和历史销售）
function calculateRestockAmount(currentStock, thresholdGram = 250) {
    // 默认阈值250克
    if (currentStock >= thresholdGram) {
        return { needRestock: false, suggestedAmount: 0 };
    }
    
    // 建议补充到至少500克
    const targetStock = 500;
    const suggestedAmount = targetStock - currentStock;
    
    // 转换为瓶数（向上取整到整瓶）
    const bottles = Math.ceil(suggestedAmount / 13) * 13;
    
    return {
        needRestock: true,
        suggestedAmount: bottles,
        suggestedBottles: bottles / 13,
        currentGram: currentStock,
        targetGram: targetStock
    };
}

// 获取客户类型名称
function getCustomerTypeName(type) {
    const types = {
        normal: '普通客户',
        member: '会员',
        vip: 'VIP',
        student: '学生',
        meituan: '美团团购',
        douyin: '抖音团购',
        dianping: '大众点评',
        xiaohongshu: '小红书',
        custom: '其他平台'
    };
    return types[type] || '普通客户';
}

// 获取折扣率
function getDiscount(type) {
    switch (type) {
        case 'member':
            return (config.memberDiscount || 10) / 100;
        case 'vip':
            return (config.vipDiscount || 20) / 100;
        case 'student':
            return (config.studentDiscount || 15) / 100;
        default:
            return 0;
    }
}

// 获取平台费率（V3.0新增）
function getPlatformFeeRate(platform) {
    if (!config.platformFees || !config.platformFees[platform]) {
        return 0;
    }
    return (config.platformFees[platform].feeRate || 0) / 100;
}

// 计算实际收款金额（扣除平台费用）
function calculateActualPayment(originalPrice, platform) {
    const feeRate = getPlatformFeeRate(platform);
    return originalPrice * (1 - feeRate);
}

// 计算费用（支持按时长和包日）
function calculateBillableHours(duration) {
    const totalMinutes = Math.floor(duration / (1000 * 60));
    const fullHours = Math.floor(totalMinutes / 60);
    const remainingMinutes = totalMinutes % 60;
    
    let billableHours = fullHours;
    
    if (remainingMinutes > 0) {
        if (remainingMinutes <= 30) {
            billableHours += 0.5;
        } else {
            billableHours += 1;
        }
    }
    
    return billableHours;
}

function calculatePrice(duration, chargeType, customerType) {
    const discount = getDiscount(customerType);
    
    if (chargeType === 'daily') {
        return config.pricePerDay * (1 - discount);
    } else {
        const billableHours = calculateBillableHours(duration);
        const originalPrice = billableHours * (config.pricePerHour || 15);
        return originalPrice * (1 - discount);
    }
}

// 获取类型名称
function getTypeName(type) {
    const names = {
        rent: '房租',
        purchase: '进货',
        utilities: '水电',
        salary: '人工',
        other: '其他'
    };
    return names[type] || '其他';
}

// 更新店铺名称显示
function updateShopNameDisplay() {
    const nameDisplay = document.getElementById('shopNameDisplay');
    if (nameDisplay && config.shopName) {
        nameDisplay.textContent = config.shopName;
    }
}

// 显示通知
function showNotification(message, duration = 3000) {
    // 检查是否支持通知
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('拼豆计时器', {
            body: message,
            icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🎨</text></svg>'
        });
    }
    
    // 页面内提示
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 10000;
        animation: slideIn 0.3s ease;
        font-size: 14px;
        font-weight: 500;
    `;
    
    // 添加动画样式
    if (!document.getElementById('notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(400px); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(400px); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, duration);
}

// 初始化后台计时器
let globalTimerInterval = null;
let lastUpdateTime = Date.now();

function startGlobalTimer() {
    if (globalTimerInterval) return;
    
    // 从localStorage恢复状态
    const savedLastUpdate = localStorage.getItem('perlerTimerLastUpdate');
    if (savedLastUpdate) {
        lastUpdateTime = parseInt(savedLastUpdate);
    }
    
    globalTimerInterval = setInterval(() => {
        const now = Date.now();
        const elapsed = now - lastUpdateTime;
        
        // 保存最后更新时间
        localStorage.setItem('perlerTimerLastUpdate', now.toString());
        
        // 更新所有正在计时的桌位
        const tables = JSON.parse(localStorage.getItem('perlerTimerTables') || '[]');
        let hasChanges = false;
        
        tables.forEach(table => {
            if (table.status === 'in-use' && !table.paused && table.startTime) {
                // 桌位在计时中，确保startTime是最新的
                hasChanges = true;
            }
        });
        
        if (hasChanges) {
            localStorage.setItem('perlerTimerTables', JSON.stringify(tables));
        }
        
        lastUpdateTime = now;
    }, 1000);
}

// 停止全局计时器
function stopGlobalTimer() {
    if (globalTimerInterval) {
        clearInterval(globalTimerInterval);
        globalTimerInterval = null;
    }
}

// 恢复后台计时（页面可见性变化时处理）
function handleVisibilityChange() {
    if (document.hidden) {
        // 页面隐藏，确保计时器继续运行
        startGlobalTimer();
    } else {
        // 页面可见，恢复正常计时
        const now = Date.now();
        const savedLastUpdate = localStorage.getItem('perlerTimerLastUpdate');
        
        if (savedLastUpdate) {
            const lastUpdate = parseInt(savedLastUpdate);
            const elapsed = now - lastUpdate;
            
            // 如果页面隐藏超过5秒，需要调整计时
            if (elapsed > 5000) {
                const tables = JSON.parse(localStorage.getItem('perlerTimerTables') || '[]');
                
                tables.forEach(table => {
                    if (table.status === 'in-use' && !table.paused && table.startTime) {
                        // 补偿隐藏期间的时间
                        table.startTime += elapsed;
                    }
                });
                
                localStorage.setItem('perlerTimerTables', JSON.stringify(tables));
            }
        }
        
        localStorage.setItem('perlerTimerLastUpdate', now.toString());
        startGlobalTimer();
    }
}

// 初始化桌位数据
function initTables() {
    let tables = JSON.parse(localStorage.getItem('perlerTimerTables'));
    
    if (!tables || tables.length === 0) {
        tables = [];
        const count = config.tableCount || 30;
        
        for (let i = 1; i <= count; i++) {
            tables.push({
                id: `table_${i}`,
                name: `${i}号桌`,
                status: 'free',
                startTime: null,
                pauseTime: null,
                paused: false,
                chargeType: null,
                customerType: null,
                customerPhone: null,
                note: null
            });
        }
        
        localStorage.setItem('perlerTimerTables', JSON.stringify(tables));
    }
    
    return tables;
}

// 初始化
loadConfig();

// 初始化桌位
initTables();

// 启动全局计时器
startGlobalTimer();

// 监听页面可见性变化
document.addEventListener('visibilitychange', handleVisibilityChange);

// 请求通知权限
if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
}

// 页面卸载前保存状态
window.addEventListener('beforeunload', () => {
    localStorage.setItem('perlerTimerLastUpdate', Date.now().toString());
});

// 页面加载完成
window.addEventListener('load', () => {
    localStorage.setItem('perlerTimerLastUpdate', Date.now().toString());
    
    // 注册Service Worker（支持离线使用）
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./service-worker.js')
            .then(registration => {
                console.log('Service Worker注册成功:', registration);
            })
            .catch(error => {
                console.log('Service Worker注册失败:', error);
            });
    }
});

// ==================== V3.1新增：用户管理功能 ====================

// 当前登录用户
let currentUser = null;

// 用户登录
function login(username, password) {
    const users = config.users || [];
    const user = users.find(u => u.username === username && u.password === password);
    
    if (user) {
        currentUser = user;
        localStorage.setItem('perlerTimerCurrentUser', JSON.stringify(user));
        return { success: true, user };
    }
    
    return { success: false, message: '用户名或密码错误' };
}

// 用户登出
function logout() {
    currentUser = null;
    localStorage.removeItem('perlerTimerCurrentUser');
}

// 检查是否已登录
function checkLogin() {
    const savedUser = localStorage.getItem('perlerTimerCurrentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        return true;
    }
    return false;
}

// 获取当前用户
function getCurrentUser() {
    return currentUser;
}

// 检查用户权限
function hasPermission(requiredRole) {
    if (!currentUser) return false;
    if (requiredRole === 'admin') {
        return currentUser.role === 'admin';
    }
    return true; // user和admin都可以访问普通功能
}

// 添加用户（需要管理员权限）
function addUser(username, password, name, role) {
    if (!hasPermission('admin')) {
        return { success: false, message: '需要管理员权限' };
    }
    
    const users = config.users || [];
    if (users.find(u => u.username === username)) {
        return { success: false, message: '用户名已存在' };
    }
    
    users.push({ username, password, role, name });
    config.users = users;
    saveConfig();
    
    return { success: true };
}

// 删除用户（需要管理员权限）
function deleteUser(username) {
    if (!hasPermission('admin')) {
        return { success: false, message: '需要管理员权限' };
    }
    
    if (username === 'admin') {
        return { success: false, message: '不能删除管理员账号' };
    }
    
    const users = config.users || [];
    config.users = users.filter(u => u.username !== username);
    saveConfig();
    
    return { success: true };
}

// 修改用户信息（需要管理员权限）
function updateUser(username, password, name, role) {
    if (!hasPermission('admin')) {
        return { success: false, message: '需要管理员权限' };
    }
    
    const users = config.users || [];
    const userIndex = users.findIndex(u => u.username === username);
    
    if (userIndex === -1) {
        return { success: false, message: '用户不存在' };
    }
    
    users[userIndex] = { username, password, role, name };
    config.users = users;
    saveConfig();
    
    return { success: true };
}

// ==================== V3.1新增：费用分摊功能 ====================

// 计算费用分摊
function calculateCostSharing(totalAmount, expenses = 0) {
    if (!config.costSharing || !config.costSharing.enabled) {
        return [];
    }
    
    const { partners, sharingScope } = config.costSharing;
    const enabledPartners = partners.filter(p => p.enabled);
    
    if (enabledPartners.length === 0) {
        return [];
    }
    
    // 计算总比例
    const totalRatio = enabledPartners.reduce((sum, p) => sum + p.shareRatio, 0);
    
    // 根据分摊范围计算金额
    const baseAmount = sharingScope === 'profit' ? (totalAmount - expenses) : totalAmount;
    
    // 计算每个合伙人的份额
    const shares = enabledPartners.map(partner => ({
        name: partner.name,
        ratio: partner.shareRatio,
        amount: (baseAmount * partner.shareRatio / totalRatio).toFixed(2)
    }));
    
    return shares;
}

// 保存配置
function saveConfig() {
    localStorage.setItem('perlerTimerConfig', JSON.stringify(config));
}
