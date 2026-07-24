function mockSuccess(data, status = 200) {
  return {
    status: 'OK',
    code: status,
    message: 'OK',
    data,
    meta: {
      mock: true,
      requestId: `mock_${Date.now()}`,
    },
  }
}

export function createDemoSession() {
  return mockSuccess({
    user: {
      id: 'stu_demo_001',
      name: '김민준',
      studentId: 1,
      studentNumber: 2201,
      email: 'demo@gsm.local',
      schoolEmail: 'demo@gsm.local',
      grade: 2,
      classNum: 2,
      number: 1,
      major: 'SW_DEVELOPMENT',
      majorLabel: '소프트웨어개발과',
      specialty: 'DevOps',
      role: 'GENERAL_STUDENT',
      interests: ['클라우드 인프라', '취업 준비'],
      dataSource: 'demo',
    },
    token: '',
    permissions: {
      canManageContent: false,
      canManageUsers: false,
      canAssignRoles: false,
    },
    meta: {
      source: 'DEMO',
      fallback: false,
    },
    profileComplete: true,
    session: {
      mode: 'demo',
      transport: 'local-only',
    },
  })
}

export async function mockLogout() {
  return mockSuccess(null, 204)
}
