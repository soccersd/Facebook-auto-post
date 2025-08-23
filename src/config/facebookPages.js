// Facebook Pages Management
// ไฟล์นี้ใช้สำหรับจัดการการตั้งค่าของ Facebook Pages ทั้งหมด

class FacebookPagesManager {
  constructor() {
    // รายการเพจ Facebook ทั้งหมด - สามารถเพิ่มเพจใหม่ได้ที่นี่
    this.pages = [
      // ข้อมูลจริงจาก Facebook API Response
      {
        id: 1,
        pageId: '699047869968552',
        accessToken: 'EAA7nrgmFk08BPVMXRAn25fMQ6kly9pn8GrfnYJtZAQiSHAuyxwAL4kxIH2DdHZBdokMO9WngongJu7rYOCmOw4ZCcdz2AgFdTjpm8DZCdZBqF55nu26cFTNeJ8V8alcyRNVMTFjxEIb2nPh8SCRhWhREZAZASBSITwOVSZC2E9Q2WBy6KHNXVVB8cFJSCWrnAk2JtIRAjZAUFYW5t9sfzefLU2P5qCZCaj2h8UXhcZBZC0xEWrXNivce44e0JqoZD',
        name: 'Botshottest',
        enabled: true
      },
      {
        id: 2,
        pageId: 'YOUR_PAGE_ID_2',
        accessToken: 'YOUR_PAGE_ACCESS_TOKEN_2',
        name: 'Page 2',
        enabled: true
      },
      {
        id: 3,
        pageId: 'YOUR_PAGE_ID_3',
        accessToken: 'YOUR_PAGE_ACCESS_TOKEN_3',
        name: 'Page 3',
        enabled: true
      },
      {
        id: 4,
        pageId: 'YOUR_PAGE_ID_4',
        accessToken: 'YOUR_PAGE_ACCESS_TOKEN_4',
        name: 'Page 4',
        enabled: true
      },
      {
        id: 5,
        pageId: 'YOUR_PAGE_ID_5',
        accessToken: 'YOUR_PAGE_ACCESS_TOKEN_5',
        name: 'Page 5',
        enabled: true
      },
      {
        id: 6,
        pageId: 'YOUR_PAGE_ID_6',
        accessToken: 'YOUR_PAGE_ACCESS_TOKEN_6',
        name: 'Page 6',
        enabled: true
      },
      {
        id: 7,
        pageId: 'YOUR_PAGE_ID_7',
        accessToken: 'YOUR_PAGE_ACCESS_TOKEN_7',
        name: 'Page 7',
        enabled: true
      },
      {
        id: 8,
        pageId: 'YOUR_PAGE_ID_8',
        accessToken: 'YOUR_PAGE_ACCESS_TOKEN_8',
        name: 'Page 8',
        enabled: true
      },
      {
        id: 9,
        pageId: 'YOUR_PAGE_ID_9',
        accessToken: 'YOUR_PAGE_ACCESS_TOKEN_9',
        name: 'Page 9',
        enabled: true
      },
      {
        id: 10,
        pageId: 'YOUR_PAGE_ID_10',
        accessToken: 'YOUR_PAGE_ACCESS_TOKEN_10',
        name: 'Page 10',
        enabled: true
      },
      {
        id: 11,
        pageId: 'YOUR_PAGE_ID_11',
        accessToken: 'YOUR_PAGE_ACCESS_TOKEN_11',
        name: 'Page 11',
        enabled: true
      },
      {
        id: 12,
        pageId: 'YOUR_PAGE_ID_12',
        accessToken: 'YOUR_PAGE_ACCESS_TOKEN_12',
        name: 'Page 12',
        enabled: true
      },
      {
        id: 13,
        pageId: 'YOUR_PAGE_ID_13',
        accessToken: 'YOUR_PAGE_ACCESS_TOKEN_13',
        name: 'Page 13',
        enabled: true
      },
      {
        id: 14,
        pageId: 'YOUR_PAGE_ID_14',
        accessToken: 'YOUR_PAGE_ACCESS_TOKEN_14',
        name: 'Page 14',
        enabled: true
      },
      {
        id: 15,
        pageId: 'YOUR_PAGE_ID_15',
        accessToken: 'YOUR_PAGE_ACCESS_TOKEN_15',
        name: 'Page 15',
        enabled: true
      },
      {
        id: 16,
        pageId: 'YOUR_PAGE_ID_16',
        accessToken: 'YOUR_PAGE_ACCESS_TOKEN_16',
        name: 'Page 16',
        enabled: true
      },
      {
        id: 17,
        pageId: 'YOUR_PAGE_ID_17',
        accessToken: 'YOUR_PAGE_ACCESS_TOKEN_17',
        name: 'Page 17',
        enabled: true
      },
      {
        id: 18,
        pageId: 'YOUR_PAGE_ID_18',
        accessToken: 'YOUR_PAGE_ACCESS_TOKEN_18',
        name: 'Page 18',
        enabled: true
      },
      {
        id: 19,
        pageId: 'YOUR_PAGE_ID_19',
        accessToken: 'YOUR_PAGE_ACCESS_TOKEN_19',
        name: 'Page 19',
        enabled: true
      },
      {
        id: 20,
        pageId: 'YOUR_PAGE_ID_20',
        accessToken: 'YOUR_PAGE_ACCESS_TOKEN_20',
        name: 'Page 20',
        enabled: true
      }
      // สามารถเพิ่มเพจใหม่ได้ที่นี่ในอนาคต
    ];
  }

  // ดึงข้อมูลเพจทั้งหมดที่เปิดใช้งาน
  getEnabledPages() {
    return this.pages.filter(page => {
      // ตรวจสอบว่าเพจมีข้อมูลจริงและเปิดใช้งาน
      return page.enabled && 
             page.pageId && 
             page.accessToken && 
             !page.pageId.startsWith('YOUR_PAGE_ID_') &&
             !page.accessToken.startsWith('YOUR_PAGE_ACCESS_TOKEN_');
    });
  }

  // ดึงข้อมูลเพจตาม ID
  getPageById(id) {
    return this.pages.find(page => page.id === id);
  }

  // ดึงข้อมูลเพจตาม Facebook Page ID
  getPageByFacebookId(pageId) {
    return this.pages.find(page => page.pageId === pageId);
  }

  // เพิ่มเพจใหม่
  addPage(pageData) {
    const newId = Math.max(...this.pages.map(p => p.id)) + 1;
    const newPage = {
      id: newId,
      ...pageData,
      enabled: pageData.enabled !== undefined ? pageData.enabled : true
    };
    this.pages.push(newPage);
    return newPage;
  }

  // เปิด/ปิดการใช้งานเพจ
  togglePage(id, enabled) {
    const page = this.getPageById(id);
    if (page) {
      page.enabled = enabled;
      return true;
    }
    return false;
  }

  // อัพเดตข้อมูลเพจ
  updatePage(id, updates) {
    const page = this.getPageById(id);
    if (page) {
      Object.assign(page, updates);
      return page;
    }
    return null;
  }

  // ลบเพจ
  removePage(id) {
    const index = this.pages.findIndex(page => page.id === id);
    if (index !== -1) {
      return this.pages.splice(index, 1)[0];
    }
    return null;
  }

  // ดึงจำนวนเพจทั้งหมด
  getTotalPages() {
    return this.pages.length;
  }

  // ดึงจำนวนเพจที่เปิดใช้งาน
  getEnabledPagesCount() {
    return this.getEnabledPages().length;
  }

  // ตรวจสอบความถูกต้องของข้อมูลเพจ
  validatePagesConfiguration() {
    const errors = [];
    const enabledPages = this.getEnabledPages();
    
    enabledPages.forEach((page, index) => {
      if (!page.pageId || page.pageId.startsWith('YOUR_PAGE_ID_')) {
        errors.push(`Page ${index + 1}: Missing or invalid Facebook Page ID`);
      }
      
      if (!page.accessToken || page.accessToken.startsWith('YOUR_PAGE_ACCESS_TOKEN_')) {
        errors.push(`Page ${index + 1}: Missing or invalid Page Access Token`);
      }
      
      if (!page.name) {
        errors.push(`Page ${index + 1}: Missing page name`);
      }
    });
    
    return {
      isValid: errors.length === 0,
      errors,
      enabledPagesCount: enabledPages.length
    };
  }
}

module.exports = FacebookPagesManager;