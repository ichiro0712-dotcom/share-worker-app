export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  const weekday = weekdays[date.getDay()];

  return `${month}/${day}(${weekday})`;
};

export const formatTime = (time: string): string => {
  return time;
};

export const formatDateTime = (dateString: string, startTime: string, endTime: string): string => {
  return `${formatDate(dateString)} ${startTime}-${endTime}`;
};

export const getDeadlineText = (deadline: string): string => {
  const now = new Date();
  const deadlineDate = new Date(deadline);
  const diff = deadlineDate.getTime() - now.getTime();

  if (diff < 0) {
    return '締切済み';
  }

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  // 24時間以内の場合
  if (hours < 24) {
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}時間${minutes}分`;
  }

  // 10日以上の場合
  if (days >= 10) {
    return '10日以上';
  }

  // 1日以上10日未満の場合
  return `${days}日`;
};

// 締切が24時間以内かどうかを判定
export const isDeadlineUrgent = (deadline: string): boolean => {
  const now = new Date();
  const deadlineDate = new Date(deadline);
  const diff = deadlineDate.getTime() - now.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  return hours < 24 && diff > 0;
};

export const generateDates = (count: number = 90): Date[] => {
  const dates: Date[] = [];
  const today = new Date();

  for (let i = 0; i < count; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    dates.push(date);
  }

  return dates;
};

export const formatDateForSlider = (date: Date, index: number): { main: string; sub: string } => {
  if (index === 0) {
    return { main: '今日', sub: '' };
  }

  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  const weekday = weekdays[date.getDay()];

  return {
    main: `${month}/${day}`,
    sub: weekday
  };
};
