import { Entity } from '@app/shared/base/entity.base';

export interface SystemSettingProps {
  id: string;
  key: string;
  value: any;
  category: string;
  label: string | null;
  updatedAt: Date;
}

export class SystemSetting extends Entity<string> {
  private props: SystemSettingProps;

  private constructor(props: SystemSettingProps) {
    super(props.id);
    this.props = props;
  }

  public static create(params: {
    id: string;
    key: string;
    value: any;
    category?: string;
    label?: string | null;
  }): SystemSetting {
    return new SystemSetting({
      id: params.id,
      key: params.key,
      value: params.value,
      category: params.category ?? 'general',
      label: params.label ?? null,
      updatedAt: new Date(),
    });
  }

  public static reconstitute(props: SystemSettingProps): SystemSetting {
    return new SystemSetting(props);
  }

  public get key(): string {
    return this.props.key;
  }

  public get value(): any {
    return this.props.value;
  }

  public get category(): string {
    return this.props.category;
  }

  public get label(): string | null {
    return this.props.label;
  }

  public get updatedAt(): Date {
    return this.props.updatedAt;
  }
}
