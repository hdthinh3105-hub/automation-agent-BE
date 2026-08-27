import { MissingInfoDetectionService } from '@app/modules/ai/application/services/missing-info-detection.service';

describe('MissingInfoDetectionService', () => {
  const service = new MissingInfoDetectionService();

  it('trả MISSING_ORDER_CODE cho yêu cầu thanh toán không có mã đơn', () => {
    const flags = service.detect(
      'Yêu cầu thanh toán',
      'Tôi cần được hoàn tiền cho đơn hàng đã giao sai',
    );
    expect(flags).toContain('MISSING_ORDER_CODE');
  });

  it('KHÔNG yêu cầu mã đơn khi nội dung là câu hỏi về chính sách/kiến thức', () => {
    const flags = service.detect('Yêu cầu thanh toán', 'chính sách hoàn tiền ra sao?');
    expect(flags).not.toContain('MISSING_ORDER_CODE');
  });

  it('KHÔNG yêu cầu mã đơn khi nội dung đã có mã đơn SV-', () => {
    const flags = service.detect(
      'Yêu cầu thanh toán',
      'Tôi cần hoàn tiền đơn hàng SV-12345678 vì giao sai sản phẩm',
    );
    expect(flags).not.toContain('MISSING_ORDER_CODE');
  });

  it('không cờ gì cho nhóm Hỏi đáp thông tin', () => {
    const flags = service.detect('Hỏi đáp thông tin', 'đổi trả hàng như thế nào?');
    expect(flags).toEqual([]);
  });
});
