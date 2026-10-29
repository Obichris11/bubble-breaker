import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { render, screen } from '@testing-library/angular';
import { Screen } from './screen';
import { StatRows } from './stat-rows';

@Component({
  selector: 'bb-test-page',
  imports: [Screen],
  template: '<bb-screen [heading]="heading"><p>Body</p></bb-screen>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Page {
  protected readonly heading = 'Statistics';
}

describe('Screen', () => {
  it('shows the heading above the content', async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'a', component: Page }])],
    });
    const harness = await RouterTestingHarness.create('/a');
    expect(screen.getByRole('heading', { level: 1, name: 'Statistics' })).toBeInTheDocument();
    expect(harness.routeNativeElement).toHaveTextContent('StatisticsBody');
  });

  it('takes focus after an in-app navigation, but not on the first page load', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'a', component: Page },
          { path: 'b', component: Page },
        ]),
      ],
    });
    const harness = await RouterTestingHarness.create('/a');
    expect(screen.getByRole('heading')).not.toHaveFocus();
    await harness.navigateByUrl('/b');
    expect(screen.getByRole('heading')).toHaveFocus();
  });
});

describe('StatRows', () => {
  it('lists label and value pairs', async () => {
    await render(StatRows, {
      inputs: {
        rows: [
          { label: 'High Score', value: '1,318' },
          { label: 'Games Played', value: '22' },
        ],
      },
    });
    expect(screen.getAllByRole('term').map((term) => term.textContent)).toEqual([
      'High Score',
      'Games Played',
    ]);
    expect(screen.getAllByRole('definition').map((value) => value.textContent)).toEqual([
      '1,318',
      '22',
    ]);
  });
});
