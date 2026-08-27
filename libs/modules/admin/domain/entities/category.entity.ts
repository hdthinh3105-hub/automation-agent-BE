import { Entity } from '@app/shared/base/entity.base';

export interface CategoryProps {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
}

export class Category extends Entity<string> {
  private props: CategoryProps;

  private constructor(props: CategoryProps) {
    super(props.id);
    this.props = props;
  }

  public static create(params: { id: string; name: string }): Category {
    return new Category({
      id: params.id,
      name: params.name,
      isActive: true,
      createdAt: new Date(),
    });
  }

  public static reconstitute(props: CategoryProps): Category {
    return new Category(props);
  }

  public deactivate(): void {
    this.props.isActive = false;
  }

  public get name(): string {
    return this.props.name;
  }

  public get isActive(): boolean {
    return this.props.isActive;
  }

  public get createdAt(): Date {
    return this.props.createdAt;
  }
}
