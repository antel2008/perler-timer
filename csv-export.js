// CSV导出工具 - Excel可直接打开

/**
 * 导出CSV文件（Excel可直接打开）
 * @param {string} filename 文件名
 * @param {Array} data 数据数组（对象数组）
 * @param {Array} headers 列头（可选）
 */
function exportCSV(filename, data, headers = null) {
    if (!data || data.length === 0) {
        alert('没有数据可以导出！');
        return;
    }
    
    // 获取所有键名作为列头
    const keys = headers || Object.keys(data[0]);
    
    // 添加BOM头（解决中文乱码问题）
    let csv = '\uFEFF';
    
    // 添加列头
    csv += keys.join(',') + '\n';
    
    // 添加数据行
    data.forEach(row => {
        const rowStr = keys.map(key => {
            let value = row[key] || '';
            
            // 处理包含逗号、换行符的值
            if (typeof value === 'string' && (value.includes(',') || value.includes('\n') || value.includes('"'))) {
                value = '"' + value.replace(/"/g, '""') + '"';
            }
            
            return value;
        }).join(',');
        
        csv += rowStr + '\n';
    });
    
    // 创建Blob并下载
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename.endsWith('.csv') ? filename : filename + '.csv';
    link.click();
    URL.revokeObjectURL(url);
}

/**
 * 导出拼豆库存为CSV
 */
function exportBeadStockCSV() {
    const beads = JSON.parse(localStorage.getItem('perlerTimerBeads')) || [];
    
    const data = beads.map(b => ({
        '色号': b.code,
        '名称': b.name,
        '颜色': b.color,
        '库存(克)': b.stockGram || 0,
        '库存(瓶)': Math.floor((b.stockGram || 0) / 13),
        '拼豆数(估算)': Math.floor((b.stockGram || 0) * 300),
        '备注': b.note || ''
    }));
    
    exportCSV('拼豆库存_' + new Date().toISOString().split('T')[0] + '.csv', data);
}

/**
 * 导出订单为CSV
 */
function exportOrdersCSV() {
    const orders = JSON.parse(localStorage.getItem('perlerTimerOrders')) || [];
    
    const data = orders.map(o => ({
        '日期': o.date || new Date(o.endTime).toISOString().split('T')[0],
        '桌位': o.tableName,
        '客户类型': getCustomerTypeName(o.customerType),
        '计费方式': o.chargeType === 'daily' ? '包日' : '按时',
        '开始时间': o.startTime ? formatDateTime(o.startTime) : '-',
        '结束时间': o.endTime ? formatDateTime(o.endTime) : '-',
        '时长(分钟)': Math.round(o.duration / 60000),
        '原价': o.originalPrice ? o.originalPrice.toFixed(2) : '0.00',
        '折扣': o.discount ? (o.discount * 100).toFixed(0) + '%' : '0%',
        '实收金额': o.actualPayment ? o.actualPayment.toFixed(2) : '0.00',
        '平台费用': o.platformFee ? o.platformFee.toFixed(2) : '0.00',
        '实际到账': o.netIncome ? o.netIncome.toFixed(2) : '0.00',
        '备注': o.note || ''
    }));
    
    exportCSV('订单记录_' + new Date().toISOString().split('T')[0] + '.csv', data);
}

/**
 * 导出费用为CSV
 */
function exportExpensesCSV() {
    const expenses = JSON.parse(localStorage.getItem('perlerTimerExpenses')) || [];
    
    const data = expenses.map(e => ({
        '日期': e.date,
        '类型': getExpenseTypeName(e.type),
        '名称': e.name,
        '金额': e.amount.toFixed(2),
        '备注': e.note || ''
    }));
    
    exportCSV('费用记录_' + new Date().toISOString().split('T')[0] + '.csv', data);
}

/**
 * 导出库存操作日志为CSV
 */
function exportInventoryLogsCSV() {
    const logs = JSON.parse(localStorage.getItem('perlerTimerInventoryLogs')) || [];
    
    const data = logs.map(l => {
        const date = new Date(l.timestamp);
        const formattedDate = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
        const formattedTime = `${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
        
        return {
            '日期': formattedDate,
            '时间': formattedTime,
            '类型': l.type === 'in' ? '入库' : '出库',
            '色号': l.colors ? l.colors.map(c => c.code).join('; ') : '-',
            '数量(克)': l.colors ? l.colors.reduce((sum, c) => sum + (c.gram || 0), 0) : 0,
            '备注': l.note || ''
        };
    });
    
    exportCSV('库存日志_' + new Date().toISOString().split('T')[0] + '.csv', data);
}

/**
 * 导出日报表为CSV
 */
function exportDailyReportCSV(date) {
    const orders = JSON.parse(localStorage.getItem('perlerTimerOrders')) || [];
    const expenses = JSON.parse(localStorage.getItem('perlerTimerExpenses')) || [];
    
    const todayOrders = orders.filter(o => o.date === date);
    const todayExpenses = expenses.filter(e => e.date === date);
    
    const totalIncome = todayOrders.reduce((sum, o) => sum + (o.actualPayment || 0), 0);
    const totalExpense = todayExpenses.reduce((sum, e) => sum + e.amount, 0);
    const profit = totalIncome - totalExpense;
    
    const data = [
        {
            '项目': '日期',
            '数值': date
        },
        {
            '项目': '订单数',
            '数值': todayOrders.length
        },
        {
            '项目': '总收入',
            '数值': totalIncome.toFixed(2)
        },
        {
            '项目': '总支出',
            '数值': totalExpense.toFixed(2)
        },
        {
            '项目': '净利润',
            '数值': profit.toFixed(2)
        }
    ];
    
    exportCSV('日报表_' + date + '.csv', data);
}

/**
 * 导出色号清单为CSV
 */
function exportColorsCSV() {
    const beads = JSON.parse(localStorage.getItem('perlerTimerBeads')) || [];
    
    const data = beads.map(b => ({
        '色号': b.code,
        '名称': b.name,
        '颜色': b.color,
        '分组': b.code.charAt(0) + '组'
    }));
    
    exportCSV('色号清单_' + new Date().toISOString().split('T')[0] + '.csv', data);
}

// 获取费用类型名称
function getExpenseTypeName(type) {
    const types = {
        rent: '房租',
        purchase: '采购',
        utilities: '水电',
        salary: '工资',
        other: '其他'
    };
    return types[type] || '其他';
}
