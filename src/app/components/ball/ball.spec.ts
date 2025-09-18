import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BallComponent } from './ball';

interface BallModel {
  row: number;
  col: number;
  color: string;
}

describe('BallComponent', () => {
  let component: BallComponent;
  let fixture: ComponentFixture<BallComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BallComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(BallComponent);
    component = fixture.componentInstance;
  });

  describe('Component Initialization', () => {
    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should accept ball input', () => {
      const testBall: BallModel = { row: 5, col: 10, color: 'red' };
      component.ball = testBall;
      fixture.detectChanges();

      expect(component.ball).toBe(testBall);
    });

    it('should accept colorblindMode input', () => {
      component.colorblindMode = true;
      fixture.detectChanges();

      expect(component.colorblindMode).toBe(true);
    });
  });

  describe('Color Validation', () => {
    const validColors = ['red', 'blue', 'green', 'yellow', 'purple'];

    validColors.forEach(color => {
      it(`should handle ${color} color correctly`, () => {
        const testBall: BallModel = { row: 0, col: 0, color };
        component.ball = testBall;
        fixture.detectChanges();

        expect(component.ball.color).toBe(color);
      });
    });

    it('should handle all valid Bubble Breaker colors', () => {
      validColors.forEach(color => {
        const testBall: BallModel = { row: 0, col: 0, color };
        component.ball = testBall;
        fixture.detectChanges();

        expect(validColors).toContain(component.ball.color);
      });
    });
  });

  describe('Event Emissions', () => {
    let testBall: BallModel;

    beforeEach(() => {
      testBall = { row: 3, col: 7, color: 'blue' };
      component.ball = testBall;
      fixture.detectChanges();
    });

    it('should emit ballClick event on click', () => {
      spyOn(component.ballClick, 'emit');

      component.onClick();

      expect(component.ballClick.emit).toHaveBeenCalledWith(testBall);
    });

    it('should emit ballHover event on mouse enter', () => {
      spyOn(component.ballHover, 'emit');
      const mockEvent = new MouseEvent('mouseenter');

      component.onMouseEnter(mockEvent);

      expect(component.ballHover.emit).toHaveBeenCalledWith(mockEvent);
    });

    it('should emit ballLeave event on mouse leave', () => {
      spyOn(component.ballLeave, 'emit');

      component.onMouseLeave();

      expect(component.ballLeave.emit).toHaveBeenCalled();
    });
  });

  describe('Position Tracking', () => {
    it('should track correct row and column positions', () => {
      const positions = [
        { row: 0, col: 0 },
        { row: 9, col: 15 },
        { row: 5, col: 8 },
        { row: 2, col: 14 }
      ];

      positions.forEach(pos => {
        const testBall: BallModel = { ...pos, color: 'green' };
        component.ball = testBall;
        fixture.detectChanges();

        expect(component.ball.row).toBe(pos.row);
        expect(component.ball.col).toBe(pos.col);
      });
    });

    it('should handle boundary positions correctly', () => {
      // Test corner positions of a 10x16 grid
      const cornerPositions = [
        { row: 0, col: 0, desc: 'top-left' },
        { row: 0, col: 15, desc: 'top-right' },
        { row: 9, col: 0, desc: 'bottom-left' },
        { row: 9, col: 15, desc: 'bottom-right' }
      ];

      cornerPositions.forEach(({ row, col, desc }) => {
        const testBall: BallModel = { row, col, color: 'purple' };
        component.ball = testBall;
        fixture.detectChanges();

        expect(component.ball.row).toBe(row);
        expect(component.ball.col).toBe(col);
      });
    });
  });

  describe('Colorblind Mode', () => {
    it('should apply colorblind mode when enabled', () => {
      const testBall: BallModel = { row: 0, col: 0, color: 'red' };
      component.ball = testBall;
      component.colorblindMode = true;
      fixture.detectChanges();

      // In colorblind mode, additional visual indicators should be available
      // This test validates the mode is properly set
      expect(component.colorblindMode).toBe(true);
    });

    it('should work normally when colorblind mode is disabled', () => {
      const testBall: BallModel = { row: 0, col: 0, color: 'blue' };
      component.ball = testBall;
      component.colorblindMode = false;
      fixture.detectChanges();

      expect(component.colorblindMode).toBe(false);
    });
  });

  describe('Component Lifecycle', () => {
    it('should handle rapid ball changes', () => {
      const balls: BallModel[] = [
        { row: 1, col: 1, color: 'red' },
        { row: 2, col: 2, color: 'blue' },
        { row: 3, col: 3, color: 'green' },
        { row: 4, col: 4, color: 'yellow' },
        { row: 5, col: 5, color: 'purple' }
      ];

      balls.forEach(ball => {
        component.ball = ball;
        fixture.detectChanges();
        expect(component.ball).toBe(ball);
      });
    });

    it('should maintain event listeners through property changes', () => {
      const ball1: BallModel = { row: 1, col: 1, color: 'red' };
      const ball2: BallModel = { row: 2, col: 2, color: 'blue' };

      component.ball = ball1;
      fixture.detectChanges();

      spyOn(component.ballClick, 'emit');

      component.ball = ball2;
      fixture.detectChanges();

      component.onClick();

      expect(component.ballClick.emit).toHaveBeenCalledWith(ball2);
    });
  });

  describe('Integration with Game Board', () => {
    it('should emit the correct ball object for game board processing', () => {
      const testBall: BallModel = { row: 4, col: 12, color: 'yellow' };
      component.ball = testBall;
      fixture.detectChanges();

      spyOn(component.ballClick, 'emit');

      component.onClick();

      const emittedBall = (component.ballClick.emit as jasmine.Spy).calls.mostRecent().args[0];

      expect(emittedBall.row).toBe(4);
      expect(emittedBall.col).toBe(12);
      expect(emittedBall.color).toBe('yellow');
    });

    it('should provide consistent position data across events', () => {
      const testBall: BallModel = { row: 6, col: 9, color: 'green' };
      component.ball = testBall;
      fixture.detectChanges();

      spyOn(component.ballClick, 'emit');
      spyOn(component.ballHover, 'emit');

      // Simulate click and hover on the same ball
      component.onClick();
      component.onMouseEnter(new MouseEvent('mouseenter'));

      const clickedBall = (component.ballClick.emit as jasmine.Spy).calls.mostRecent().args[0];

      expect(clickedBall.row).toBe(testBall.row);
      expect(clickedBall.col).toBe(testBall.col);
      expect(clickedBall.color).toBe(testBall.color);
    });
  });
});