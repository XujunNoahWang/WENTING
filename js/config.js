// 应用配置
const APP_CONFIG = {
    // 用户配置
    users: [
        {
            id: 1,
            name: 'Dad',
            displayName: 'Dad',
            color: '#1d9bf0'
        },
        {
            id: 2, 
            name: 'Mom',
            displayName: 'Mom',
            color: '#e91e63'
        },
        {
            id: 3,
            name: 'Kid', 
            displayName: 'Kid',
            color: '#ff9800'
        }
    ],

    // 默认TODO数据
    defaultTodos: {
        dad: [
            {
                id: 'dad-fish-oil-morning',
                text: '早上吃鱼肝油 🐟',
                time: '08:00',
                period: '2周疗程',
                periodType: 'temporary',
                timeOrder: 1,
                note: '',
                completed: false
            },
            {
                id: 'dad-vitamin',
                text: '吃一粒善存 💊',
                time: '早餐后',
                period: '长期',
                periodType: 'ongoing',
                timeOrder: 2,
                note: '',
                completed: true
            },
            {
                id: 'dad-fish-oil-noon',
                text: '中午吃鱼肝油 🐟',
                time: '12:00',
                period: '2周疗程',
                periodType: 'temporary',
                timeOrder: 3,
                note: '',
                completed: false,
                frequency: 'every-other-day'
            },
            {
                id: 'dad-water',
                text: '喝满至少2L水 💧',
                time: '当天',
                period: '每日',
                periodType: 'ongoing',
                timeOrder: 99,
                note: '帮助降低肌酐，分多次饮用',
                completed: false
            }
        ],
        mom: [
            {
                id: 'mom-meditation',
                text: '进行10分钟冥想 🧘‍♀️',
                time: '晨间',
                period: '每日',
                periodType: 'ongoing',
                timeOrder: 0,
                note: '可以使用冥想app引导',
                completed: true
            },
            {
                id: 'mom-yoga',
                text: '做简单瑜伽练习 🧘‍♀️',
                time: '18:00',
                period: '每日',
                periodType: 'ongoing',
                timeOrder: 6,
                note: '',
                completed: false,
                frequency: 'weekly'
            },
            {
                id: 'mom-music',
                text: '听舒缓音乐20分钟 🎵',
                time: '晚上',
                period: '3个月',
                periodType: 'temporary',
                timeOrder: 7,
                note: '',
                completed: false
            },
            {
                id: 'mom-diary',
                text: '写情绪日记 📝',
                time: '睡前',
                period: '1个月',
                periodType: 'temporary',
                timeOrder: 9,
                note: '',
                completed: false
            },
            {
                id: 'mom-walk',
                text: '进行30分钟散步 🚶‍♀️',
                time: '当天',
                period: '每日',
                periodType: 'ongoing',
                timeOrder: 99,
                note: '',
                completed: false
            }
        ],
        kid: [
            {
                id: 'kid-vitamin-d',
                text: '吃维生素D 🌞',
                time: '早餐后',
                period: '每日',
                periodType: 'ongoing',
                timeOrder: 2,
                note: '',
                completed: false
            },
            {
                id: 'kid-ice',
                text: '脚部冰敷15分钟 🧊',
                time: '15:00',
                period: '2周',
                periodType: 'temporary',
                timeOrder: 5,
                note: '用毛巾包裹冰袋，避免直接接触',
                completed: false
            },
            {
                id: 'kid-vitamin',
                text: '吃维生素片 💊',
                time: '晚餐后',
                period: '每日',
                periodType: 'ongoing',
                timeOrder: 8,
                note: '',
                completed: true
            },
            {
                id: 'kid-milk',
                text: '喝一杯牛奶 🥛',
                time: '睡前',
                period: '每日',
                periodType: 'ongoing',
                timeOrder: 9,
                note: '200ml，温牛奶更助睡眠',
                completed: false
            },
            {
                id: 'kid-avoid-exercise',
                text: '避免剧烈运动 ⚠️',
                time: '当天',
                period: '2周',
                periodType: 'temporary',
                timeOrder: 99,
                note: '',
                completed: false
            }
        ]
    },

    // 天气配置
    weather: {
        location: '深圳',
        icon: '☀️',
        condition: '晴朗',
        temperature: '22°C',
        wind: {
            level: '3级',
            label: '风力'
        },
        humidity: {
            value: '65%',
            label: '湿度'
        }
    }
};