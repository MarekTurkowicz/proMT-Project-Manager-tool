from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from datetime import date, timedelta

from api.models import Project, Funding, FundingTask, ProjectFunding, Task


class Command(BaseCommand):
    help = "Zasieje dane demo: użytkownik PM, projekty, finansowanie, szablony zadań finansowania i auto-skopiowane taski."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Usuwa dane demo przed ponownym dodaniem.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        self.stdout.write(self.style.MIGRATE_HEADING("== SEED DEMO START =="))

        User = get_user_model()

        # 1) Użytkownik PM (do logowania i bycia ownerem projektów)
        pm_username = "pm"
        pm_password = "pm12345!"
        pm, created_pm = User.objects.get_or_create(
            username=pm_username, defaults={"is_staff": True, "is_active": True}
        )
        if created_pm:
            pm.set_password(pm_password)
            pm.save()
            self.stdout.write(
                self.style.SUCCESS(
                    f"Utworzono użytkownika: {pm_username} / {pm_password}"
                )
            )
        else:
            self.stdout.write(f"Użytkownik istnieje: {pm_username}")

        if options["reset"]:
            # usuwamy tylko nasze obiekty demo (po nazwach), żeby nie ruszyć Twoich ręcznych danych
            Task.objects.filter(title__in=["Soundcheck", "Kupić struny"]).delete()
            ProjectFunding.objects.filter(
                project__name__in=["Trasa Jesień 2025", "Nagranie EP 2025"]
            ).delete()
            FundingTask.objects.filter(funding__name="Grant Kultura 2025").delete()
            Funding.objects.filter(name="Grant Kultura 2025").delete()
            Project.objects.filter(
                name__in=["Trasa Jesień 2025", "Nagranie EP 2025"]
            ).delete()
            self.stdout.write(self.style.WARNING("Usunięto poprzednie dane demo."))

        # 2) Projekty
        proj_a, _ = Project.objects.get_or_create(
            name="Trasa Jesień 2025",
            defaults={
                "description": "Miasta: X, Y, Z",
                "status": Project.Status.NEW,
                "owner": pm,
                "start_date": date.today() + timedelta(days=7),
                "end_date": date.today() + timedelta(days=60),
            },
        )
        proj_b, _ = Project.objects.get_or_create(
            name="Nagranie EP 2025",
            defaults={
                "description": "Studio + miks",
                "status": Project.Status.NEW,
                "owner": pm,
                "start_date": date.today() + timedelta(days=30),
                "end_date": date.today() + timedelta(days=120),
            },
        )
        self.stdout.write(
            self.style.SUCCESS(f"Projekty OK: {proj_a.name}, {proj_b.name}")
        )

        # 3) Finansowanie (grant)
        grant, _ = Funding.objects.get_or_create(
            name="Grant Kultura 2025",
            defaults={
                "type": Funding.Type.GRANT,
                "funder": "Instytucja X",
                "currency": "PLN",
                "start_date": date.today(),
                "end_date": date.today() + timedelta(days=180),
                "reporting_deadline": date.today() + timedelta(days=200),
                "description": "Wsparcie działań koncertowych.",
            },
        )
        self.stdout.write(self.style.SUCCESS(f"Finansowanie OK: {grant.name}"))

        # 4) Szablony zadań finansowania (FundingTask)
        ft_specs = [
            dict(title="Zebrać faktury", default_priority=2, default_due_days=15),
            dict(title="Raport końcowy", default_priority=3, default_due_days=30),
        ]
        for spec in ft_specs:
            FundingTask.objects.get_or_create(
                funding=grant,
                title=spec["title"],
                defaults={
                    "description": "",
                    "default_status": "todo",
                    "default_priority": spec["default_priority"],
                    "default_est_hours": None,
                    "default_due_days": spec["default_due_days"],
                    "mandatory": True,
                },
            )
        self.stdout.write(self.style.SUCCESS("FundingTask OK (szablony dodane)."))

        # 5) Podpięcie finansowania do Projektu A (odpali signal i skopiuje taski)
        link, created_link = ProjectFunding.objects.get_or_create(
            project=proj_a,
            funding=grant,
            defaults={
                "allocation_start": date.today() + timedelta(days=1),
                "is_primary": True,
            },
        )
        if created_link:
            self.stdout.write(
                self.style.SUCCESS(
                    "ProjectFunding OK (utworzono, taski powinny zostać skopiowane)."
                )
            )
        else:
            self.stdout.write(
                "ProjectFunding już istniało (skopiowane taski mogły istnieć wcześniej)."
            )

        # 6) Zwykłe taski (niegrantowe) w projektach
        Task.objects.get_or_create(
            project=proj_a,
            title="Soundcheck",
            defaults={
                "description": "Ustawić nagłośnienie i monitory",
                "status": "todo",
                "priority": 2,
                "due_date": proj_a.start_date,
            },
        )
        Task.objects.get_or_create(
            project=proj_b,
            title="Kupić struny",
            defaults={
                "description": "Komplet strun do gitary",
                "status": "todo",
                "priority": 1,
                "due_date": proj_b.start_date,
            },
        )

        # 7) Log podsumowujący
        t_a = Task.objects.filter(project=proj_a).count()
        t_b = Task.objects.filter(project=proj_b).count()
        self.stdout.write(self.style.HTTP_INFO(f"Taski w {proj_a.name}: {t_a}"))
        self.stdout.write(self.style.HTTP_INFO(f"Taski w {proj_b.name}: {t_b}"))

        self.stdout.write(self.style.SUCCESS("== SEED DEMO DONE =="))
